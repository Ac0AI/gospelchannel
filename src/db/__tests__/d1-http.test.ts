import { describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createD1HttpDatabase, createD1HttpSql } from "../d1-http";
import { churches } from "../d1-schema";

describe("D1 HTTP database for Node jobs", () => {
  it("maps raw positional results and passes bound parameters", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ success: true, result: [{ success: true, results: { rows: [["test"]] } }] }), { status: 200 }));
    const db = createD1HttpDatabase({ accountId: "a", databaseId: "d", token: "t", fetchImpl });
    const rows = await db.select({ slug: churches.slug }).from(churches).where(eq(churches.slug, "test"));
    expect(rows).toEqual([{ slug: "test" }]);
    const request = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(request[1].body)).params).toEqual(["test"]);
  });

  it("fails closed on authorization errors", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ success: false }), { status: 403 }));
    const db = createD1HttpDatabase({ accountId: "a", databaseId: "d", token: "t", fetchImpl });
    await expect(db.select({ slug: churches.slug }).from(churches)).rejects.toMatchObject({ cause: expect.objectContaining({ message: expect.stringContaining("403") }) });
  });
});

describe("D1 HTTP overload", () => {
  it("waits out a 429 and sends the same query again", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return calls === 1
        ? new Response(JSON.stringify({ success: false }), { status: 429 })
        : new Response(JSON.stringify({ success: true, result: [{ success: true, results: [{ n: 1 }] }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const sql = createD1HttpSql({ accountId: "a", databaseId: "d", token: "t", fetchImpl, retryDelaysMs: [0] });
    await expect(sql.query("SELECT 1 AS n")).resolves.toEqual([{ n: 1 }]);
    expect(calls).toBe(2);
  });

  it("does not retry other failures", async () => {
    let calls = 0;
    const fetchImpl = (async () => { calls += 1; return new Response(JSON.stringify({ success: false }), { status: 400 }); }) as unknown as typeof fetch;
    const sql = createD1HttpSql({ accountId: "a", databaseId: "d", token: "t", fetchImpl, retryDelaysMs: [0] });
    await expect(sql.query("SELECT 1")).rejects.toThrow(/400/);
    expect(calls).toBe(1);
  });
});

