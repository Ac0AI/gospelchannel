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

test("waits out a 429 overload and sends the same request again", async () => {
  const env = { CLOUDFLARE_ACCOUNT_ID: "a", GOSPEL_D1_DATABASE_ID: "db", GOSPEL_D1_API_TOKEN: "token" };
  const bodies = [];
  const client = createD1Client(env, async (_url, init) => {
    bodies.push(init.body);
    return bodies.length < 3
      ? { ok: false, status: 429, json: async () => ({ success: false }) }
      : { ok: true, status: 200, json: async () => ({ success: true, result: [{ success: true, results: [{ n: 1 }] }] }) };
  }, { retryDelaysMs: [0, 0] });
  assert.deepEqual(await client.query("SELECT 1 AS n"), [{ n: 1 }]);
  assert.equal(bodies.length, 3);
  assert.equal(new Set(bodies).size, 1);
});

test("gives up after the last retry, and never retries other failures", async () => {
  const env = { CLOUDFLARE_ACCOUNT_ID: "a", GOSPEL_D1_DATABASE_ID: "db", GOSPEL_D1_API_TOKEN: "token" };
  let calls = 0;
  const overloaded = createD1Client(env, async () => { calls += 1; return { ok: false, status: 429, json: async () => ({ success: false }) }; }, { retryDelaysMs: [0, 0] });
  await assert.rejects(overloaded.query("SELECT 1"), /429/);
  assert.equal(calls, 3);
  calls = 0;
  const broken = createD1Client(env, async () => { calls += 1; return { ok: false, status: 400, json: async () => ({ success: false }) }; }, { retryDelaysMs: [0, 0] });
  await assert.rejects(broken.query("SELECT 1"), /400/);
  assert.equal(calls, 1);
});
