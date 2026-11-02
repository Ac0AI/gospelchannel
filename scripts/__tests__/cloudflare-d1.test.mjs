import { test } from "vitest";
import assert from "node:assert/strict";
import { createD1Client } from "../lib/cloudflare-d1.mjs";

test("requires explicit D1 credentials and fails closed", async () => {
  assert.throws(() => createD1Client({ GOSPEL_D1_DATABASE_ID: "db" }), /Missing/);
  const env = { CLOUDFLARE_ACCOUNT_ID: "a", GOSPEL_D1_DATABASE_ID: "db", GOSPEL_D1_API_TOKEN: "token" };
  const client = createD1Client(env, async () => ({ ok: false, status: 403, json: async () => ({ success: false }) }));
  await assert.rejects(client.query("SELECT 1"), /403/);
});

test("passes bound parameters and returns results", async () => {
  const env = { CLOUDFLARE_ACCOUNT_ID: "a", GOSPEL_D1_DATABASE_ID: "db", GOSPEL_D1_API_TOKEN: "token" };
  let request;
  const client = createD1Client(env, async (_url, init) => {
    request = JSON.parse(init.body);
    return { ok: true, status: 200, json: async () => ({ success: true, result: [{ success: true, results: [{ n: 1 }] }] }) };
  });
  assert.deepEqual(await client.query("SELECT ? AS n", [1]), [{ n: 1 }]);
  assert.deepEqual(request.params, [1]);
});
