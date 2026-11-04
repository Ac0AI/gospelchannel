// Explicit D1 access for Node jobs. Missing credentials fail closed.
//
// A job waits out D1's resource window: on 429 (D1 overloaded, the request did
// not run; a batch is a single transaction) it pauses and sends the same
// request again, 15, 30, 60 and 120 s. The site serves visitors from the same
// database, and the related-churches reconcile failed on 2026-11-04 when it
// started right after the facet build's writes. Any other failure is final.
const DEFAULT_RETRY_DELAYS_MS = [15_000, 30_000, 60_000, 120_000];

export function createD1Client(env, fetchImpl = fetch, { retryDelaysMs = DEFAULT_RETRY_DELAYS_MS } = {}) {
  const { CLOUDFLARE_ACCOUNT_ID: accountId, GOSPEL_D1_DATABASE_ID: databaseId } = env;
  const token = env.GOSPEL_D1_API_TOKEN || env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !databaseId || !token) throw new Error("Missing Gospel D1 account, database, or token");
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`;
  async function request(body) {
    for (let attempt = 0; ; attempt += 1) {
      const response = await fetchImpl(url, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });
      if (response.status === 429 && attempt < retryDelaysMs.length) {
        console.warn(`  D1 overloaded (429), retrying in ${retryDelaysMs[attempt] / 1000} s`);
        await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt]));
        continue;
      }
      const result = await response.json();
      if (!response.ok || !result.success || !Array.isArray(result.result) || result.result.some((row) => !row.success)) throw new Error(`Gospel D1 request failed (${response.status})`);
      return result.result;
    }
  }
  return {
    async query(sql, params = []) {
      const rows = await request({ sql, params });
      if (rows.length !== 1) throw new Error("Expected one D1 query result");
      return rows[0].results;
    },
    batch: (batch) => request({ batch }),
  };
}

export function createD1TaggedSql(env, fetchImpl = fetch) {
  const client = createD1Client(env, fetchImpl);
  return (strings, ...values) => client.query(
    strings.reduce((sql, part, index) => sql + (index ? "?" : "") + part, ""),
    values.map((value) => value == null ? null : typeof value === "boolean" ? Number(value) : typeof value === "object" ? JSON.stringify(value) : value),
  );
}
