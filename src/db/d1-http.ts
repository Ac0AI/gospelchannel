import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./d1-schema";
import { createSqlClient } from "./d1-sql";

type Config = { accountId: string; databaseId: string; token: string; fetchImpl?: typeof fetch; retryDelaysMs?: number[] };

// Node jobs wait out D1's resource window: on 429 (D1 overloaded; the request
// did not run) they pause and send the same request again. The site serves
// visitors from the same database. Same policy as scripts/lib/cloudflare-d1.mjs.
const DEFAULT_RETRY_DELAYS_MS = [15_000, 30_000, 60_000, 120_000];

async function postWithOverloadRetry(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  retryDelaysMs: number[],
): Promise<Response> {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetchImpl(url, init);
    if (response.status !== 429 || attempt >= retryDelaysMs.length) return response;
    console.warn(`  D1 overloaded (429), retrying in ${retryDelaysMs[attempt] / 1000} s`);
    await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt]));
  }
}

export function createD1HttpSql(config: Config) {
  const { accountId, databaseId, token, fetchImpl = fetch, retryDelaysMs = DEFAULT_RETRY_DELAYS_MS } = config;
  if (!accountId || !databaseId || !token) throw new Error("Missing Gospel D1 account, database, or token");
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`;
  return createSqlClient(async (sql, params) => {
    const response = await postWithOverloadRetry(fetchImpl, url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ sql, params }),
    }, retryDelaysMs);
    const body = await response.json() as { success?: boolean; result?: Array<{ success?: boolean; results: Record<string, unknown>[] }> };
    if (!response.ok || !body.success || body.result?.length !== 1 || !body.result[0]?.success) throw new Error(`Gospel D1 query failed (${response.status})`);
    return body.result[0].results;
  });
}

/** D1 for Node-only jobs which cannot access a Worker binding. */
export function createD1HttpDatabase(config: Config) {
  const { accountId, databaseId, token, fetchImpl = fetch, retryDelaysMs = DEFAULT_RETRY_DELAYS_MS } = config;
  if (!accountId || !databaseId || !token) throw new Error("Missing Gospel D1 account, database, or token");
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/raw`;
  return drizzle(async (sql, params, method) => {
    const response = await postWithOverloadRetry(fetchImpl, url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ sql, params }),
    }, retryDelaysMs);
    const body = await response.json() as { success?: boolean; result?: Array<{ success?: boolean; results?: { rows?: unknown[][] } }> };
    const result = body.result?.[0];
    if (!response.ok || !body.success || body.result?.length !== 1 || !result?.success) throw new Error(`Gospel D1 query failed (${response.status})`);
    const rows = result.results?.rows ?? [];
    // sqlite-proxy's get() callback expects the first row, not a row list.
    return { rows: method === "get" ? rows[0] as unknown[] : rows };
  }, { schema });
}
