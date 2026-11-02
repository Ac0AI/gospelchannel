import { Client } from "@neondatabase/serverless";
import { createHash } from "node:crypto";
import { closeSync, existsSync, openSync, readFileSync, unlinkSync, writeFileSync, writeSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { ident, rowStatements } from "./d1-snapshot-codec.mjs";

const output = process.argv[2];
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!output || !url) throw new Error("Usage: DATABASE_URL=... node scripts/export-d1-snapshot.mjs /private/path/snapshot.sql");
if (existsSync(output) || existsSync(`${output}.manifest.json`)) throw new Error("Refusing to overwrite an existing snapshot");
// Import the exact source records before adding derived search indexes and
// mutation triggers. Otherwise triggers would rewrite the exported snapshot.
const ddl = readFileSync("drizzle-d1/0000_initial.sql", "utf8");
const sqlite = new DatabaseSync(":memory:");
sqlite.exec(ddl);
const client = new Client(url);
let fd;
let done = false;
try {
  await client.connect();
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  await client.query("SET LOCAL TIME ZONE 'UTC'");
  const { rows: columns } = await client.query(`SELECT table_name, column_name, data_type, ordinal_position
    FROM information_schema.columns WHERE table_schema='public' AND table_name IN
      (SELECT tablename FROM pg_tables WHERE schemaname='public') ORDER BY table_name, ordinal_position`);
  const { rows: primaryKeys } = await client.query(`SELECT c.relname AS table_name, a.attname AS column_name, k.ordinality
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_index i ON i.indrelid=c.oid AND i.indisprimary
    JOIN LATERAL unnest(i.indkey) WITH ORDINALITY k(attnum, ordinality) ON true
    JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=k.attnum
    WHERE n.nspname='public' ORDER BY c.relname,k.ordinality`);
  const tables = [...new Set(columns.map((column) => column.table_name))];
  const byTable = new Map(tables.map((table) => [table, columns.filter((column) => column.table_name === table)]));
  const byKey = new Map(tables.map((table) => [table, primaryKeys.filter((key) => key.table_name === table).map((key) => key.column_name)]));
  for (const table of tables) {
    const local = sqlite.prepare(`PRAGMA table_info(${ident(table)})`).all().map((column) => column.name);
    const source = byTable.get(table).map((column) => column.column_name);
    if (!byKey.get(table).length || source.some((column) => !local.includes(column))) throw new Error(`Schema or primary key mismatch: ${table}`);
  }
  // Parent tables precede children. D1 always enforces foreign keys.
  const pending = new Set(tables);
  const ordered = [];
  while (pending.size) {
    let progressed = false;
    for (const table of [...pending]) {
      const parents = sqlite.prepare(`PRAGMA foreign_key_list(${ident(table)})`).all().map((fk) => fk.table);
      if (parents.some((parent) => parent !== table && pending.has(parent))) continue;
      pending.delete(table);
      ordered.push(table);
      progressed = true;
    }
    if (!progressed) throw new Error("Foreign-key dependency cycle requires an explicit import plan");
  }
  fd = openSync(output, "wx", 0o600);
  const write = (text) => writeSync(fd, text);
  write(`${ddl}\nPRAGMA defer_foreign_keys = true;\n`);
  const manifest = { snapshotStartedAt: new Date().toISOString(), tables: {}, schemaSha256: createHash("sha256").update(ddl).digest("hex") };
  for (const table of ordered) {
    const keys = byKey.get(table);
    const selection = byTable.get(table).map(({ column_name: name, data_type: type }) => {
      const column = ident(name);
      if (type === "ARRAY") return `to_jsonb(${column})::text AS ${column}`;
      if (type === "jsonb" || type === "json") return `${column}::text AS ${column}`;
      if (type.startsWith("timestamp")) return `(extract(epoch FROM ${column}) * 1000)::bigint AS ${column}`;
      if (["text", "uuid", "integer", "real", "double precision", "boolean"].includes(type)) return column;
      throw new Error(`Unsupported Postgres type ${type} in ${table}.${name}`);
    });
    const hash = createHash("sha256");
    let count = 0;
    await client.query(`DECLARE migration_cursor NO SCROLL CURSOR FOR SELECT ${selection.join(", ")} FROM ${ident(table)} ORDER BY ${keys.map(ident).join(", ")}`);
    for (;;) {
      const { rows } = await client.query("FETCH FORWARD 2500 FROM migration_cursor");
      if (!rows.length) break;
      for (const row of rows) {
        hash.update(JSON.stringify(row)).update("\n");
        write(`${rowStatements(table, row, keys).join("\n")}\n`);
        count++;
      }
    }
    await client.query("CLOSE migration_cursor");
    manifest.tables[table] = { count, sha256: hash.digest("hex") };
    process.stdout.write(`${table}: ${count} rows\n`);
  }
  await client.query("ROLLBACK");
  closeSync(fd);
  fd = undefined;
  writeFileSync(`${output}.manifest.json`, JSON.stringify(manifest, null, 2), { flag: "wx", mode: 0o600 });
  done = true;
} finally {
  if (fd !== undefined) closeSync(fd);
  if (!done && existsSync(output)) unlinkSync(output);
  await client.end().catch(() => {});
  sqlite.close();
}
