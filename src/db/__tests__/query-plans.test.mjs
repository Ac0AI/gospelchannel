import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

// Guard: the queries a page view runs must use an index that bounds them, not
// walk every church. Without index statistics SQLite guessed wrong and city
// pages and related churches read every approved church (~4 billion rows a
// day, D1 overloads after deploys, 2026-11-04). Production now keeps
// statistics (PRAGMA optimize in the daily cron), so this test does the same:
// a few thousand synthetic churches, ANALYZE, then the real page functions
// with every statement recorded and explained.

const context = vi.hoisted(() => ({ binding: null, recorded: null }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: () => ({ env: { GOSPEL_D1: context.binding } }) }));
vi.mock("next/cache", () => ({ unstable_cache: (fn) => fn, revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));

import { getChurchFacetPageData, getChurchIndexSummariesBySlugs, getChurchPublicPageData, getRelatedChurches } from "@/lib/church";
import { getChurchDirectorySeedsBySlugs, getChurchNamesBySlugsAsync, getChurchStatsAsync, getSitemapChurchSeedSliceAsync, writePrecomputedChurchStats } from "@/lib/content";
import { writeFacetLinkGeneration } from "@/lib/facet-links";
import { computeFacetLinkRows } from "@/lib/facet-links-build";

// Statements that read the whole set on purpose, with the reason. Everything
// else that touches churches must be bounded by an index.
const ALLOWED = [
  {
    match: /row_number\(\) OVER \(ORDER BY name, slug\) - 1 AS rn/,
    why: "sitemap seed index: one pass over the indexable set per hour (cached), replacing quadratic OFFSET chunks",
  },
  {
    match: /SELECT json_type\(sources, '\$\.official_review'\)|FROM church_enrichments\s+WHERE json_type\(sources, '\$\.official_review'\)/,
    why: "official review slugs: small table, cached for an hour",
  },
  {
    match: /SELECT DISTINCT country FROM churches/,
    why: "country slug resolution: ~200 distinct countries, cached for an hour",
  },
  {
    // Browse rows for a style or denomination page walk directory_rank in
    // order and stop at LIMIT: bounded by the page, not the table. Their
    // totals come from the precomputed facet links.
    match: /ORDER BY directory_rank ASC NULLS LAST, slug ASC\s+LIMIT/,
    why: "facet browse rows: ordered index walk that stops at the page size",
  },
];

const CITIES = Array.from({ length: 300 }, (_, i) => `city-${i}`);
const COUNTRIES = ["Sweden", "United States", "Germany", "Brazil", "Kenya", "Norway", "Spain", "Nigeria"];
const STYLES = [["Contemporary worship"], ["Gospel"], ["Charismatic worship"], ["Acoustic worship"], ["Gospel", "Modern worship"]];
const DENOMINATIONS = ["Pentecostal", "Baptist", "Church of England", "Lutheran", "Assemblies of God", null];
const N = 4000;

let db;
function churchSlug(i) { return `church-${String(i).padStart(5, "0")}`; }

beforeAll(() => {
  vi.stubEnv("GOSPEL_D1_DATABASE_ID", "");
  vi.stubEnv("GOSPEL_BUILD_OFFLINE", "0");
  db = new DatabaseSync(":memory:");
  for (const file of ["0000_initial.sql", "0001_profile_name_approval.sql", "0002_search_indexes.sql",
    "0004_directory_text_search.sql", "0005_facet_links.sql"]) {
    db.exec(readFileSync(`drizzle-d1/${file}`, "utf8"));
  }
  const insert = db.prepare(`INSERT INTO churches (slug, name, country, location, status, city_slug, directory_rank,
    directory_ready, display_score, music_style, denomination, spotify_playlist_ids, related_church_slugs)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`);
  db.exec("BEGIN");
  for (let i = 0; i < N; i += 1) {
    // Skewed cities: a few large, many small, like the real directory.
    const city = CITIES[Math.floor(CITIES.length * (i % 97) * (i % 89) / (97 * 89))];
    const related = Array.from({ length: 8 }, (_, k) => churchSlug((i * 7 + k * 131 + 1) % N));
    insert.run(churchSlug(i), `Church ${(i * 7919) % N}`, COUNTRIES[i % COUNTRIES.length], `${city}, Region`,
      i % 40 === 0 ? "archived" : "approved", city, i, 40 + (i % 60),
      JSON.stringify(STYLES[i % STYLES.length]), DENOMINATIONS[i % DENOMINATIONS.length],
      JSON.stringify(i % 2 ? ["playlist"] : []), JSON.stringify(related));
  }
  db.exec("COMMIT");
  db.exec("ANALYZE");

  context.binding = {
    prepare(sql) {
      return { bind(...values) {
        context.recorded?.push({ sql, values });
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
});

afterAll(() => { db.close(); vi.unstubAllEnvs(); });

function explain({ sql, values }) {
  const statement = db.prepare(`EXPLAIN QUERY PLAN ${sql}`);
  const rows = /\?\d/.test(sql)
    ? statement.all(Object.fromEntries(values.map((value, i) => [`?${i + 1}`, value])))
    : statement.all(...values);
  return rows.map((row) => row.detail);
}

// A plan line that walks churches without a bounding index.
const UNBOUNDED = [
  /^SCAN (churches|c)\b/,
  /^SEARCH (churches|c) USING (COVERING )?INDEX \S+ \(status=\?\)$/,
];

async function plansFor(run) {
  context.recorded = [];
  await run();
  const statements = context.recorded;
  context.recorded = null;
  return statements
    .filter((statement) => /\b(FROM|JOIN)\s+churches\b/i.test(statement.sql))
    .map((statement) => ({ ...statement, plan: explain(statement) }));
}

function unbounded(plans) {
  return plans
    .filter(({ sql }) => !ALLOWED.some((allowed) => allowed.match.test(sql)))
    .filter(({ plan }) => plan.some((line) => UNBOUNDED.some((pattern) => pattern.test(line))))
    .map(({ sql, plan }) => `${sql.replace(/\s+/g, " ").slice(0, 220)}\n    → ${plan.join(" | ")}`);
}

describe("page queries are bounded by an index", () => {
  it("site stats on every page read the precomputed row, and equal a live count", async () => {
    const live = await plansFor(() => getChurchStatsAsync());
    expect(unbounded(live).length).toBeGreaterThan(0); // before the nightly build: a count over every church
    const written = await writePrecomputedChurchStats();
    let stats;
    const plans = await plansFor(async () => { stats = await getChurchStatsAsync(); });
    expect(unbounded(plans)).toEqual([]);
    expect(plans).toEqual([]); // app_kv only, nothing touches churches
    expect({ churchCount: stats.churchCount, countryCount: stats.countryCount }).toEqual(written);
    expect(written.churchCount).toBe(N - N / 40);
  });

  it("church page and its related churches", async () => {
    const plans = await plansFor(async () => {
      await getChurchPublicPageData(churchSlug(123));
      await getRelatedChurches(churchSlug(123));
    });
    expect(plans.length).toBeGreaterThan(0);
    expect(unbounded(plans)).toEqual([]);
  });

  it("city page, first and a later page", async () => {
    const plans = await plansFor(async () => {
      await getChurchFacetPageData({ kind: "city", slug: "city-3", page: 1, pageSize: 24 });
      await getChurchFacetPageData({ kind: "city", slug: "city-3", page: 3, pageSize: 24 });
    });
    expect(unbounded(plans)).toEqual([]);
  });

  it("country, style and denomination pages read precomputed links and totals", async () => {
    const { rows } = await computeFacetLinkRows();
    await writeFacetLinkGeneration("plan-test", rows);
    const plans = await plansFor(async () => {
      await getChurchFacetPageData({ kind: "style", slug: "gospel", page: 1, pageSize: 24 });
      await getChurchFacetPageData({ kind: "denomination", slug: "baptist", page: 1, pageSize: 24 });
      await getChurchFacetPageData({ kind: "country", slug: "sweden", page: 1, pageSize: 24 });
    });
    expect(unbounded(plans)).toEqual([]);
    // No whole-set aggregate left on these pages.
    expect(plans.filter(({ sql }) => /count\(\*\)|GROUP BY/i.test(sql)).map(({ sql }) => sql.slice(0, 120))).toEqual([]);
  });

  it("sitemap church chunks and slug lookups (names, seeds, vote top list)", async () => {
    const plans = await plansFor(async () => {
      await getSitemapChurchSeedSliceAsync(0, 5000);
      await getChurchNamesBySlugsAsync([churchSlug(5), churchSlug(9), churchSlug(11)]);
      await getChurchDirectorySeedsBySlugs([churchSlug(5), churchSlug(9)]);
      const top = await getChurchIndexSummariesBySlugs([churchSlug(7), churchSlug(8), churchSlug(7)]);
      expect([...top.keys()].sort()).toEqual([churchSlug(7), churchSlug(8)]);
    });
    expect(unbounded(plans)).toEqual([]);
  });

  it("the guard catches shapes that stay unbounded even with statistics", () => {
    const shapes = [
      `SELECT slug FROM churches WHERE status = 'approved' ORDER BY name, slug LIMIT 2000 OFFSET 2000`,
      `SELECT count(*) FROM churches WHERE status = 'approved' AND denomination LIKE '%bapt%'`,
    ];
    for (const sql of shapes) {
      const plan = explain({ sql, values: [] });
      expect(plan.some((line) => UNBOUNDED.some((pattern) => pattern.test(line))), `${sql}\n${plan.join(" | ")}`).toBe(true);
    }
  });

  it("without statistics the planner walks every approved church, which is why the cron keeps them", () => {
    const bare = new DatabaseSync(":memory:");
    bare.exec(readFileSync("drizzle-d1/0000_initial.sql", "utf8"));
    const statement = bare.prepare(`EXPLAIN QUERY PLAN SELECT slug FROM churches
      WHERE slug IN (SELECT value FROM json_each(?)) AND status = 'approved' AND (display_score IS NULL OR display_score >= 45)`);
    const plan = statement.all(JSON.stringify([churchSlug(1)])).map((row) => row.detail);
    bare.close();
    expect(plan.some((line) => /\(status=\?\)$/.test(line)), plan.join(" | ")).toBe(true);
  });

});
