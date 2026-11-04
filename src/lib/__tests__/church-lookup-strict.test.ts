import { beforeEach, describe, expect, it, vi } from "vitest";

// A failed database read must not look like "no such church" on the church
// page: that renders a 404 which ISR then keeps for a day (seen after the
// 2026-11-04 deploy, when two listed churches were stuck on a cached 404).

const dbFailure = new Error("D1_ERROR: overloaded");

vi.mock("@/lib/runtime-mode", () => ({ isOfflinePublicBuild: () => false }));

vi.mock("@/lib/data-client", () => {
  const failingQuery = {
    select: () => failingQuery,
    eq: () => failingQuery,
    in: () => failingQuery,
    limit: () => failingQuery,
    maybeSingle: async () => ({ data: null, error: { message: "D1_ERROR: overloaded" } }),
  };
  return {
    hasServiceConfig: () => true,
    createAdminClient: () => ({ from: () => failingQuery }),
  };
});

const campusQuery = vi.fn(async () => {
  throw dbFailure;
});

vi.mock("@/db", () => {
  const chain: Record<string, unknown> = {};
  for (const step of ["select", "from", "innerJoin", "leftJoin", "where", "orderBy"]) {
    chain[step] = () => chain;
  }
  chain.limit = () => campusQuery();
  return {
    getDb: () => chain,
    getSql: () => {
      throw dbFailure;
    },
    hasDatabaseConfig: () => true,
    schema: new Proxy({}, { get: () => new Proxy({}, { get: () => ({}) }) }),
  };
});

describe("getChurchBySlugAsync when the database read fails", () => {
  it("falls back to the snapshot, or undefined, by default", async () => {
    const { getChurchBySlugAsync } = await import("../content");
    await expect(getChurchBySlugAsync("church-newer-than-the-snapshot")).resolves.toBeUndefined();
  });

  it("throws in strict mode when the snapshot does not have the church", async () => {
    const { getChurchBySlugAsync } = await import("../content");
    await expect(
      getChurchBySlugAsync("church-newer-than-the-snapshot", { strict: true }),
    ).rejects.toThrow("overloaded");
  });

  it("still serves the snapshot copy in strict mode when it has one", async () => {
    const { getChurchBySlugAsync } = await import("../content");
    const church = await getChurchBySlugAsync("wearechurch", { strict: true });
    expect(church?.slug).toBe("wearechurch");
  });
});

describe("getCampusBySlug when the database read fails", () => {
  beforeEach(() => {
    campusQuery.mockClear();
  });

  it("strict mode retries and throws even after an earlier failure in the isolate", async () => {
    const { getCampusBySlug } = await import("../church-networks");

    // Default mode: the failure is swallowed, flagged for the isolate and cached.
    await expect(getCampusBySlug("some-campus")).resolves.toBeNull();
    await expect(getCampusBySlug("other-campus")).resolves.toBeNull();
    expect(campusQuery).toHaveBeenCalledTimes(1);

    // The church page does not trust that: it queries again and gets the error.
    await expect(getCampusBySlug("some-campus", { strict: true })).rejects.toThrow("overloaded");
    expect(campusQuery).toHaveBeenCalledTimes(2);
  });
});
