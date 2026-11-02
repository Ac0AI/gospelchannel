import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag: vi.fn() }));
vi.mock("server-only", () => ({}));

import { getDb, getSql, schema } from "../../src/db";
import { getChurchIndexPageData, getChurchDirectoryFilterOptions, fetchFacetRelatedLinks } from "../../src/lib/church";
import { getChurchSearchSuggestions } from "../../src/lib/search-suggestions";
import { findChurchesNear, getChurchProfile } from "../../src/lib/mcp/church-queries";

// Explicit opt-in: these checks only read the selected migration database.
describe.skipIf(process.env.GOSPEL_D1_VERIFY_REMOTE !== "1")("remote D1 application reads", () => {
  beforeAll(() => {
    if (!process.env.GOSPEL_D1_DATABASE_ID) throw new Error("Select the migration database explicitly");
    vi.spyOn(console, "error").mockImplementation((message) => { throw new Error(String(message)); });
  });
  afterAll(() => vi.restoreAllMocks());

  it("loads the Austin directory and a real profile", async () => {
    const page = await getChurchIndexPageData({ page: 1, pageSize: 24, filters: { citySlug: "austin" } });
    expect(page.pageItems).toHaveLength(24);
    expect(page.totalCount).toBeGreaterThan(300);
    const profile = await getChurchProfile(page.pageItems[0].slug);
    expect(profile?.slug).toBe(page.pageItems[0].slug);
  });

  it("runs filters and related facets within D1 limits", async () => {
    const options = await getChurchDirectoryFilterOptions({ citySlug: "austin" });
    expect(options.countries.length).toBeGreaterThan(0);
    const facets = await fetchFacetRelatedLinks({ citySlug: "austin" });
    expect(facets.city.some((city) => city.slug === "austin")).toBe(true);
  });

  it("serves prefix and typo suggestions from the full index", async () => {
    for (const query of ["austin", "hilsong", "londn"]) {
      const suggestions = await getChurchSearchSuggestions(query);
      expect(suggestions.some((row) => row.type === "church"), query).toBe(true);
    }
  });

  it("uses D1 math and JSON for nearby churches", async () => {
    const churches = await findChurchesNear({ latitude: 30.27, longitude: -97.74, radiusKm: 40 });
    expect(churches.length).toBeGreaterThan(0);
    expect(churches.every((church) => Number.isFinite(church.distanceKm))).toBe(true);
  });

  it("decodes existing authentication records through Drizzle", async () => {
    const users = await getDb().select({ id: schema.user.id, createdAt: schema.user.createdAt }).from(schema.user).limit(1);
    expect(users).toHaveLength(1);
    expect(users[0].createdAt).toBeInstanceOf(Date);
    const [integrity] = await getSql().query("SELECT count(*) AS n FROM pragma_foreign_key_check");
    expect(integrity.n).toBe(0);
  });
});
