import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./d1-schema";
import { createSqlClient } from "./d1-sql";

type Config = { accountId: string; databaseId: string; token: string; fetchImpl?: typeof fetch };

export function createD1HttpSql(config: Config) {
  const { accountId, databaseId, token, fetchImpl = fetch } = config;
  if (!accountId || !databaseId || !token) throw new Error("Missing Gospel D1 account, database, or token");
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`;
  return createSqlClient(async (sql, params) => {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ sql, params }),
    });
    const body = await response.json() as { success?: boolean; result?: Array<{ success?: boolean; results: Record<string, unknown>[] }> };
    if (!response.ok || !body.success || body.result?.length !== 1 || !body.result[0]?.success) throw new Error(`Gospel D1 query failed (${response.status})`);
    return body.result[0].results;
  });
}

/** D1 for Node-only jobs which cannot access a Worker binding. */
export function createD1HttpDatabase(config: Config) {
  const { accountId, databaseId, token, fetchImpl = fetch } = config;
  if (!accountId || !databaseId || !token) throw new Error("Missing Gospel D1 account, database, or token");
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/raw`;
  return drizzle(async (sql, params, method) => {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ sql, params }),
    });
    const body = await response.json() as { success?: boolean; result?: Array<{ success?: boolean; results?: { rows?: unknown[][] } }> };
    const result = body.result?.[0];
    if (!response.ok || !body.success || body.result?.length !== 1 || !result?.success) throw new Error(`Gospel D1 query failed (${response.status})`);
    const rows = result.results?.rows ?? [];
    // sqlite-proxy's get() callback expects the first row, not a row list.
    return { rows: method === "get" ? rows[0] as unknown[] : rows };
  }, { schema });
}
