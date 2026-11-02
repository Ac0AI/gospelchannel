import { decodeD1Row } from "./d1-values";

export type D1Binding = {
  prepare(sql: string): { bind(...params: (string | number | null)[]): {
    all<T>(): Promise<{ results: T[] }>;
  } };
};

function parameter(value: unknown): string | number | null {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "boolean") return Number(value);
  if (typeof value === "number" || typeof value === "string") return value;
  return JSON.stringify(value);
}

export function createD1Sql(binding: D1Binding) {
  return createSqlClient(async (sql, params) => (await binding.prepare(sql).bind(...params).all<Record<string, unknown>>()).results);
}

export function createSqlClient(execute: (sql: string, params: (string | number | null)[]) => Promise<Record<string, unknown>[]>) {
  async function query(sql: string, params: unknown[] = [], table?: string) {
    // Retain numbered placeholders at existing call sites. SQL syntax itself
    // must be SQLite; never attempt to translate PostgreSQL at runtime.
    const text = sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|--[^\n]*|\/\*[\s\S]*?\*\/|\$(\d+)/g,
      (match, number) => number ? `?${number}` : match);
    const rows = await execute(text, params.map(parameter));
    return rows.map((row) => decodeD1Row(row, table));
  }
  function sql(strings: TemplateStringsArray, ...values: unknown[]) {
    return query(strings.reduce((text, part, index) => text + (index ? `$${index}` : "") + part, ""), values);
  }
  return Object.assign(sql, { query });
}
