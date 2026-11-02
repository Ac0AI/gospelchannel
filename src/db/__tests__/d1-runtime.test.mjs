import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

const context = vi.hoisted(() => ({ binding: null, worker: true }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: () => {
  if (!context.worker) throw new Error("No Worker context");
  return { env: { GOSPEL_D1: context.binding } };
} }));
vi.mock("next/cache", () => ({ unstable_cache: (fn) => fn, revalidateTag: vi.fn() }));
vi.mock("server-only", () => ({}));

import { getDb, getSql, hasDatabaseConfig, schema } from "@/db";
import { createAdminClient } from "@/lib/data-client";
import { getChurchIndexPageData, getChurchDirectoryFilterOptions, fetchFacetRelatedLinks } from "@/lib/church";
import { getChurchSearchSuggestions } from "@/lib/search-suggestions";
import { findChurchesNear } from "@/lib/mcp/church-queries";
import { reviewProfileEdit } from "@/lib/church-profile";
import { eq } from "drizzle-orm";

let db;
beforeEach(() => {
  context.worker = true;
  vi.stubEnv("GOSPEL_D1_DATABASE_ID", "");
  vi.stubEnv("GOSPEL_BUILD_OFFLINE", "0");
  db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  for (const file of ["0000_initial.sql", "0001_profile_name_approval.sql", "0002_search_indexes.sql", "0004_directory_text_search.sql"]) {
    db.exec(readFileSync(`drizzle-d1/${file}`, "utf8"));
  }
  context.binding = {
    prepare(sql) {
      return { bind(...values) {
        const statement = db.prepare(sql);
        const rows = () => /\?\d/.test(sql)
          ? statement.all(Object.fromEntries(values.map((value, i) => [`?${i + 1}`, value])))
          : statement.all(...values);
        return {
          all: async () => ({ results: rows() }),
          raw: async () => rows().map((row) => Object.values(row)),
          run: async () => { rows(); return { success: true }; },
        };
      } };
    },
  };
  db.exec(`INSERT INTO churches (slug, name, country, location, status, city_slug, directory_rank, directory_ready,
    display_score, music_style, denomination, language, spotify_playlist_ids)
    VALUES ('migration-test', 'Åby Hillsong Church', 'United States', 'Austin, Texas', 'approved', 'austin', 1, 1,
      100, '["Contemporary worship"]', 'Pentecostal', 'English; Swedish', '["playlist"]');
    INSERT INTO church_enrichments (id, church_slug, latitude, longitude, languages, service_times,
      children_ministry, youth_ministry, what_to_expect, parking_info, enrichment_status)
    VALUES ('enrichment-test', 'migration-test', 30.27, -97.74, '["English"]', '[{"day":"Sunday","time":"10:00"}]',
      1, 0, 'Welcome', 'On site', 'complete');
    INSERT INTO user (id, name, email) VALUES ('test-user', 'Test', 'test.invalid');`);
  // Falling back to a bundled directory must never make these tests pass.
  vi.spyOn(console, "error").mockImplementation((message) => { throw new Error(String(message)); });
});

afterEach(() => { db.close(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("D1 runtime", () => {
  it("retains HTTP access for Node jobs without a Worker context", async () => {
    context.worker = false;
    vi.stubEnv("GOSPEL_D1_DATABASE_ID", "node-only-database");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "node-only-account");
    vi.stubEnv("GOSPEL_D1_API_TOKEN", "node-only-token");
    const http = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      success: true, result: [{ success: true, results: [{ count: 3 }] }],
    })));
    expect(hasDatabaseConfig()).toBe(true);
    expect(await getSql().query("SELECT count(*) AS count FROM churches")).toEqual([{ count: 3 }]);
    expect(http).toHaveBeenCalledOnce();
  });

  it("uses the Worker binding even when Node-only D1 credentials are present", async () => {
    vi.stubEnv("GOSPEL_D1_DATABASE_ID", "node-only-database");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "");
    vi.stubEnv("GOSPEL_D1_API_TOKEN", "");
    const http = vi.spyOn(globalThis, "fetch");

    expect(hasDatabaseConfig()).toBe(true);
    expect(await getSql().query("SELECT count(*) AS count FROM churches")).toEqual([{ count: 1 }]);
    const users = await getDb().select().from(schema.user);
    expect(users).toHaveLength(1);
    expect(http).not.toHaveBeenCalled();
  });

  it("fails closed when the Worker has no binding instead of using Node credentials", () => {
    context.binding = null;
    vi.stubEnv("GOSPEL_D1_DATABASE_ID", "node-only-database");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "node-only-account");
    vi.stubEnv("GOSPEL_D1_API_TOKEN", "node-only-token");
    expect(hasDatabaseConfig()).toBe(false);
    expect(() => getSql()).toThrow("Missing GOSPEL_D1 database binding");
    expect(() => getDb()).toThrow("Missing GOSPEL_D1 database binding");
  });

  it("binds numbered values without altering SQL literals and decodes stored values", async () => {
    expect(await getSql().query("SELECT '$1' AS literal, $2 AS second, $1 AS first", ["one", "two"]))
      .toEqual([{ literal: "$1", second: "two", first: "one" }]);
    const [row] = await getSql().query("SELECT music_style, directory_ready, created_at FROM churches WHERE slug = $1", ["migration-test"]);
    expect(row.music_style).toEqual(["Contemporary worship"]);
    expect(row.directory_ready).toBe(true);
    expect(typeof row.created_at).toBe("string");
  });

  it("preserves JSON, booleans and timestamps in raw writes and Drizzle auth reads", async () => {
    const date = "2026-11-01T12:00:00.000Z";
    const result = await createAdminClient().from("churches").update({ aliases: ["A", "B"], verified_at: date, show_email_publicly: true }).eq("slug", "migration-test").select("aliases, verified_at, show_email_publicly");
    expect(result.error).toBeNull();
    expect(result.data).toEqual([{ aliases: ["A", "B"], verified_at: date, show_email_publicly: true }]);
    const [user] = await getDb().select().from(schema.user).where(eq(schema.user.id, "test-user"));
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.emailVerified).toBe(false);
  });

  it("runs directory, language and facet queries against SQLite", async () => {
    const page = await getChurchIndexPageData({ page: 1, pageSize: 24, filters: { citySlug: "austin", language: "Swedish", hasKids: true, hasServiceTimes: true } });
    expect(page.totalCount).toBe(1);
    expect(page.pageItems.map((church) => church.slug)).toEqual(["migration-test"]);
    const filters = await getChurchDirectoryFilterOptions({ citySlug: "austin" });
    expect(filters.languages.map((language) => language.label)).toEqual(expect.arrayContaining(["English", "Swedish"]));
    const facets = await fetchFacetRelatedLinks({ citySlug: "austin" });
    expect(facets.city[0]).toMatchObject({ slug: "austin", count: 1 });
  });

  it("keeps international prefix search and typo matching", async () => {
    for (const query of ["åby", "hilsong", "åby hillsong church austin"]) {
      expect((await getChurchSearchSuggestions(query)).map((result) => result.id)).toContain("migration-test");
    }
    const page = await getChurchIndexPageData({ query: "åby", page: 1, pageSize: 24 });
    expect(page.pageItems.map((church) => church.slug)).toEqual(["migration-test"]);
  });

  it("inserts batches without exceeding D1's 100 bound parameters", async () => {
    const rows = Array.from({ length: 100 }, (_, index) => ({ slug: `batch-${index}`, name: `Batch ${index}`, status: "pending", country: "SE" }));
    const result = await createAdminClient().from("churches").insert(rows).select("slug");
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(100);
    const upsert = await createAdminClient().from("churches").upsert(rows.map((row) => ({ ...row, name: "Updated" })), { onConflict: "slug" }).select("name");
    expect(upsert.error).toBeNull();
    expect(upsert.data.every((row) => row.name === "Updated")).toBe(true);
  });

  it("retains nearby distance and verified facilities", async () => {
    const churches = await findChurchesNear({ latitude: 30.27, longitude: -97.74, kids: true, hasServiceTimes: true });
    expect(churches[0]).toMatchObject({ slug: "migration-test", hasKids: true, hasVisitorDetails: true, hasParkingInfo: true, distanceKm: 0 });
  });

  it("approves names atomically and refreshes search", async () => {
    db.exec(`INSERT INTO church_profile_edits (id, church_slug, submitted_by, field_name, field_value)
      VALUES ('edit-test', 'migration-test', 'test-user', 'name', '"Renamed Church"')`);
    await reviewProfileEdit("edit-test", "approved", "test-user");
    expect(db.prepare("SELECT name FROM churches WHERE slug='migration-test'").get()?.name).toBe("Renamed Church");
    expect(db.prepare("SELECT official_church_name FROM church_enrichments WHERE id='enrichment-test'").get()?.official_church_name).toBe("Renamed Church");
    expect(db.prepare("SELECT count(*) AS n FROM search_suggestions_words WHERE search_suggestions_words MATCH 'Renamed'").get()?.n).toBeGreaterThan(0);
    await expect(reviewProfileEdit("edit-test", "approved", "test-user")).rejects.toThrow("could not be approved");
  });
});
