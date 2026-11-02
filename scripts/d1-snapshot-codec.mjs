// Helpers for the temporary, read-only Postgres -> SQLite snapshot export.
// D1 has a 100 KB statement limit, so all text is emitted in bounded chunks.
export const TEXT_CHUNK_BYTES = 20_000;
export const LARGE_PAYLOAD_BYTES = 1_000_000;

export function ident(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

export function textChunks(value, maxBytes = TEXT_CHUNK_BYTES) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 4) throw new Error("Invalid UTF-8 chunk size");
  const input = Buffer.from(value, "utf8");
  const parts = [];
  for (let start = 0; start < input.length;) {
    let end = Math.min(start + maxBytes, input.length);
    // Do not split inside a multibyte UTF-8 character.
    while (end < input.length && (input[end] & 0xc0) === 0x80) end--;
    parts.push(input.subarray(start, end).toString("utf8"));
    start = end;
  }
  if (parts.length === 0) parts.push("");
  return parts;
}

export function literal(value) {
  if (value === null) return "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Non-finite numeric value");
    return String(value);
  }
  if (typeof value !== "string") throw new Error(`Unsupported value type: ${typeof value}`);
  return `CAST(X'${Buffer.from(value, "utf8").toString("hex")}' AS TEXT)`;
}

// Key columns must be present and are never chunked: they address the updates.
export function rowStatements(table, row, keys) {
  if (!keys.length || keys.some((key) => row[key] == null)) {
    throw new Error(`Missing primary key for ${table}`);
  }
  const predicates = keys.map((key) => `${ident(key)} = ${literal(row[key])}`).join(" AND ");
  const first = {};
  const remaining = [];
  const payloads = [];
  let approximateBytes = 0;
  for (const [column, value] of Object.entries(row)) {
    if (typeof value !== "string") {
      first[column] = value;
      approximateBytes += 16;
      continue;
    }
    const bytes = Buffer.byteLength(value, "utf8");
    if (table === "church_enrichments" && column === "raw_crawled_pages" && bytes > LARGE_PAYLOAD_BYTES) {
      first[column] = null;
      textChunks(value).forEach((chunk, part) => payloads.push({ chunk, part }));
      continue;
    }
    approximateBytes += bytes;
    if (keys.includes(column) && bytes > TEXT_CHUNK_BYTES) throw new Error(`Oversized primary key in ${table}`);
    const chunks = textChunks(value);
    first[column] = chunks[0];
    for (const chunk of chunks.slice(1)) remaining.push({ column, chunk });
  }
  // Leave headroom for SQLite row overhead and encoded field values.
  if (approximateBytes > 1_800_000) throw new Error(`Row too large for D1 in ${table}`);
  const columns = Object.keys(first);
  const insert = () => `INSERT INTO ${ident(table)} (${columns.map(ident).join(", ")}) VALUES (${columns.map((key) => literal(first[key])).join(", ")});`;
  while (Buffer.byteLength(insert(), "utf8") > 95_000) {
    const candidate = columns.filter((column) => !keys.includes(column) && typeof first[column] === "string" && first[column].length)
      .sort((a, b) => Buffer.byteLength(first[b]) - Buffer.byteLength(first[a]))[0];
    if (!candidate) throw new Error(`Insert statement too large for D1 in ${table}`);
    const chunk = first[candidate];
    first[candidate] = "";
    const next = remaining.findIndex((item) => item.column === candidate);
    remaining.splice(next < 0 ? remaining.length : next, 0, { column: candidate, chunk });
  }
  const statements = [insert()];
  for (const { column, chunk } of remaining) {
    statements.push(`UPDATE ${ident(table)} SET ${ident(column)} = ${ident(column)} || ${literal(chunk)} WHERE ${predicates};`);
  }
  for (const { chunk, part } of payloads) {
    statements.push(`INSERT INTO church_enrichment_payload_chunks (enrichment_id, field, part, value) VALUES (${literal(row.id)}, 'raw_crawled_pages', ${part}, ${literal(chunk)});`);
  }
  for (const statement of statements) {
    if (Buffer.byteLength(statement, "utf8") > 95_000) throw new Error(`SQL statement too large for D1 in ${table}`);
  }
  return statements;
}
