// Explicit D1 access for Node jobs. A missing token must never fall back to a
// stale Neon database after the D1 cutover has been selected.
export function createD1Client(env, fetchImpl = fetch) {
  const { CLOUDFLARE_ACCOUNT_ID: accountId, GOSPEL_D1_DATABASE_ID: databaseId, GOSPEL_D1_API_TOKEN: token } = env;
  if (!accountId || !databaseId || !token) throw new Error("Missing Gospel D1 account, database, or token");
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`;
  async function request(body) {
    const response = await fetchImpl(url, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok || !result.success || !Array.isArray(result.result) || result.result.some((row) => !row.success)) throw new Error(`Gospel D1 request failed (${response.status})`);
    return result.result;
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
