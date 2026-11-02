import { getTableColumns, getTableName, is, Table } from "drizzle-orm";
import * as schema from "./d1-schema";

type Kind = "json" | "date" | "boolean" | "other";
const tables = new Map<string, Map<string, Kind>>();
const shared = new Map<string, Set<Kind>>();
for (const table of Object.values(schema)) {
  if (!is(table, Table)) continue;
  const columns = new Map<string, Kind>();
  for (const column of Object.values(getTableColumns(table))) {
    const kind = ["json", "date", "boolean"].includes(column.dataType) ? column.dataType as Kind : "other";
    columns.set(column.name, kind);
    const kinds = shared.get(column.name) ?? new Set<Kind>();
    kinds.add(kind);
    shared.set(column.name, kinds);
  }
  tables.set(getTableName(table), columns);
}

/** Keep the existing raw-query API's JSON, boolean and ISO date values. */
export function decodeD1Row(row: Record<string, unknown>, table?: string) {
  return Object.fromEntries(Object.entries(row).map(([column, value]) => {
    const kinds = shared.get(column);
    const kind = table ? tables.get(table)?.get(column) : kinds?.size === 1 ? [...kinds][0] : undefined;
    if (value != null) {
      if (kind === "json" && typeof value === "string") value = JSON.parse(value);
      if (kind === "boolean") value = Boolean(value);
      if (kind === "date" && typeof value === "number") value = new Date(value).toISOString();
    }
    return [column, value];
  }));
}

export function encodeD1Value(table: string, column: string, value: unknown): unknown {
  if (value == null) return null;
  const kind = tables.get(table)?.get(column);
  if (kind === "json") return JSON.stringify(value);
  if (kind === "date") {
    const time = value instanceof Date ? value.getTime() : typeof value === "number" ? value : Date.parse(String(value));
    if (!Number.isFinite(time)) throw new Error(`Invalid date for ${table}.${column}`);
    return time;
  }
  return value;
}
