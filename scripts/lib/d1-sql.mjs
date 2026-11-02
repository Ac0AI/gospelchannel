import { readFileSync } from "node:fs";
import { createD1Client } from "./cloudflare-d1.mjs";

// Checked against the Drizzle schema by the migration regression tests.
const columnTypes = JSON.parse(readFileSync(new URL("./d1-column-types.json", import.meta.url), "utf8"));
const sharedTypes = new Map();
for (const columns of Object.values(columnTypes)) for (const [column, kind] of Object.entries(columns)) {
  const kinds = sharedTypes.get(column) ?? new Set();
  kinds.add(kind);
  sharedTypes.set(column, kinds);
}

export function decodeD1ScriptRow(row, table) {
  return Object.fromEntries(Object.entries(row).map(([column, value]) => {
    const kinds = sharedTypes.get(column);
    const kind = table ? columnTypes[table]?.[column] : kinds?.size === 1 ? [...kinds][0] : undefined;
    if (value != null) {
      if (kind === "json" && typeof value === "string") value = JSON.parse(value);
      if (kind === "boolean") value = Boolean(value);
      if (kind === "date" && typeof value === "number") value = new Date(value).toISOString();
    }
    return [column, value];
  }));
}

/** Encode named fields explicitly; ISO-looking text inside JSON stays text. */
export function encodeD1ScriptValue(table, column, value) {
  if (value == null) return value;
  const kind = columnTypes[table]?.[column];
  if (kind === "date") {
    const time = value instanceof Date ? value.getTime() : typeof value === "number" ? value : Date.parse(value);
    if (!Number.isFinite(time)) throw new Error(`Invalid date for ${table}.${column}`);
    return time;
  }
  if (kind === "json") return typeof value === "string" ? value : JSON.stringify(value);
  return bind(value);
}

function bind(value) {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "boolean") return Number(value);
  return typeof value === "object" ? JSON.stringify(value) : value;
}

/** Node maintenance scripts use explicit SQLite SQL and D1 credentials. */
export function createD1ScriptSql(env = process.env, client = createD1Client(env)) {
  function statement(text, params = []) {
    // Preserve literals/comments while retaining existing numbered parameters.
    const sql = text.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|--[^\n]*|\/\*[\s\S]*?\*\/|\$(\d+)/g,
      (match, number) => number ? `?${number}` : match);
    if (params.length > 100) throw new Error("D1 accepts at most 100 bound parameters; use JSON batches");
    return { sql, params: params.map(bind) };
  }
  async function query(text, params = [], table) {
    const prepared = statement(text, params);
    return (await client.query(prepared.sql, prepared.params)).map((row) => decodeD1ScriptRow(row, table));
  }
  function sql(strings, ...params) {
    return query(strings.reduce((text, part, index) => text + (index ? `$${index}` : "") + part, ""), params);
  }
  async function batch(statements) {
    const results = await client.batch(statements.map(({ sql, params }) => statement(sql, params)));
    return results.map((result, index) => result.results.map((row) => decodeD1ScriptRow(row, statements[index].table)));
  }
  return Object.assign(sql, { query, batch });
}
