import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

// Precomputed facet links (drizzle-d1/0005_facet_links.sql) must give the
// pages exactly what the live aggregate gave them, so this runs both against a
// real SQLite database with the D1 migrations applied.

const context = vi.hoisted(() => ({ binding: null }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: () => ({ env: { GOSPEL_D1: context.binding } }) }));
vi.mock("next/cache", () => ({ unstable_cache: (fn) => fn, revalidateTag: vi.fn() }));
vi.mock("server-only", () => ({}));

import { fetchFacetRelatedLinks, getAllChurchFacetLinks, getChurchFacetPageData } from "@/lib/church";
import { FACET_RELATED_LIMITS, readFacetLinks, writeFacetLinkGeneration } from "@/lib/facet-links";
import { computeFacetLinkRows } from "@/lib/facet-links-build";

const CHURCHES = [
  // slug, country, location, city_slug, rank, ready, music_style, denomination, status
  ["a1", "Sweden", "Stockholm", "stockholm", 1, 1, ["Contemporary worship"], "Pentecostal", "approved"],
  ["a2", "Sweden", "Stockholm", "stockholm", 2, 1, ["Gospel"], "Baptist", "approved"],
  ["a3", "Sweden", "Göteborg", "goteborg", 3, 1, ["Charismatic worship", "Gospel"], "Pingstkyrka", "approved"],
  ["a4", "Sweden", "Malmö", "malmo", 4, 1, ["Acoustic worship"], "Church of England", "approved"],
  ["b1", "United States", "Austin, Texas", "austin", 5, 1, ["Contemporary worship"], "Assemblies of God", "approved"],
  ["b2", "United States", "Austin, Texas", "austin", 6, 1, ["Gospel"], "Baptist", "approved"],
  ["b3", "United States", "Dallas, Texas", "dallas", 7, 1, ["Modern worship"], "Episcopal", "approved"],
  ["b4", "United States", "Dallas, Texas", "dallas", 8, 1, ["Contemporary gospel"], "Baptist", "approved"],
  // Excluded from browse aggregates: not display-ready, and archived.
  ["x1", "Sweden", "Stockholm", "stockholm", 9, 0, ["Gospel"], "Baptist", "approved"],
  ["x2", "Sweden", "Stockholm", "stockholm", 10, 1, ["Gospel"], "Baptist", "archived"],
];

let db;
beforeEach(() => {
  vi.stubEnv("GOSPEL_D1_DATABASE_ID", "");
  vi.stubEnv("GOSPEL_BUILD_OFFLINE", "0");
  db = new DatabaseSync(":memory:");
  for (const file of ["0000_initial.sql", "0001_profile_name_approval.sql", "0002_search_indexes.sql",
    "0004_directory_text_search.sql", "0005_facet_links.sql"]) {
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
  const insert = db.prepare(`INSERT INTO churches (slug, name, country, location, status, city_slug, directory_rank,
    directory_ready, display_score, music_style, denomination) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 80, ?, ?)`);
  for (const [slug, country, location, citySlug, rank, ready, styles, denomination, status] of CHURCHES) {
    insert.run(slug, `Church ${slug}`, country, location, status, citySlug, rank, ready, JSON.stringify(styles), denomination);
  }
});

afterEach(() => { db.close(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });

async function build() {
  const { rows } = await computeFacetLinkRows();
  await writeFacetLinkGeneration(`gen-${Math.random()}`, rows);
  return rows;
}

describe("precomputed facet links", () => {
  it("reads nothing before the first build, so callers compute live", async () => {
    await expect(readFacetLinks("all", "")).resolves.toBeNull();
    await expect(getAllChurchFacetLinks()).resolves.toEqual(await fetchFacetRelatedLinks({}));
  });

  it("returns exactly the live aggregate for the whole directory and every precomputed source", async () => {
    await build();
    expect(await readFacetLinks("all", "")).toEqual(await fetchFacetRelatedLinks({}));

    const sources = [
      ["style", "contemporary-worship", { styleSlug: "contemporary-worship" }],
      ["style", "gospel", { styleSlug: "gospel" }],
      ["denomination", "pentecostal", { denominationSlug: "pentecostal" }],
      ["denomination", "baptist", { denominationSlug: "baptist" }],
      ["country", "sweden", { country: "Sweden" }],
      ["country", "united-states", { country: "United States" }],
    ];
    for (const [kind, slug, filters] of sources) {
      const live = await fetchFacetRelatedLinks(filters, FACET_RELATED_LIMITS[kind]);
      expect(live.city.length + live.country.length).toBeGreaterThan(0);
      expect(await readFacetLinks(kind, slug), `${kind}:${slug}`).toEqual(live);
    }
  });

  it("leaves out churches the browse set leaves out", async () => {
    await build();
    const stockholm = (await readFacetLinks("all", "")).city.find((link) => link.slug === "stockholm");
    expect(stockholm.count).toBe(2);
  });

  it("a new build replaces the previous generation completely", async () => {
    await build();
    db.exec(`UPDATE churches SET status = 'archived' WHERE slug = 'a2'`);
    await build();
    expect(db.prepare(`SELECT count(DISTINCT generation) AS n FROM facet_links`).get().n).toBe(1);
    const stockholm = (await readFacetLinks("all", "")).city.find((link) => link.slug === "stockholm");
    expect(stockholm.count).toBe(1);
  });

  it("facet pages read the precomputed set for countries, styles and denominations, and stay live for cities", async () => {
    await build();
    db.exec(`UPDATE facet_links SET label = 'Precomputed ' || label`);

    const style = await getChurchFacetPageData({ kind: "style", slug: "gospel", page: 1, pageSize: 24 });
    expect(style.relatedLinks.country.every((link) => link.label.startsWith("Precomputed "))).toBe(true);

    const city = await getChurchFacetPageData({ kind: "city", slug: "stockholm", page: 1, pageSize: 24 });
    expect(city.relatedLinks.country.map((link) => link.label)).toEqual(["Sweden"]);
  });
});
