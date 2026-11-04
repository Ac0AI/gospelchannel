import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

// The sitemap's church list is read in (name, slug) order in chunks from
// keyset boundaries instead of LIMIT/OFFSET. The chunks must hold exactly the
// churches the offset version held, in the same order.

const context = vi.hoisted(() => ({ binding: null }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: () => ({ env: { GOSPEL_D1: context.binding } }) }));
vi.mock("next/cache", () => ({ unstable_cache: (fn) => fn, revalidateTag: vi.fn() }));
vi.mock("server-only", () => ({}));

import {
  fetchSitemapChurchSeedChunkFromDb,
  fetchSitemapChurchSeedIndexFromDb,
  getSitemapChurchSeedCountAsync,
  getSitemapChurchSeedSliceAsync,
} from "@/lib/content";

let db;
let expected;
beforeEach(() => {
  vi.stubEnv("GOSPEL_D1_DATABASE_ID", "");
  vi.stubEnv("GOSPEL_BUILD_OFFLINE", "0");
  db = new DatabaseSync(":memory:");
  for (const file of ["0000_initial.sql", "0001_profile_name_approval.sql", "0002_search_indexes.sql",
    "0004_directory_text_search.sql"]) {
    db.exec(readFileSync(`drizzle-d1/${file}`, "utf8"));
  }
  context.binding = {
    prepare(sql) {
      return { bind(...values) {
        const statement = db.prepare(sql);
        const rows = () => /\?\d/.test(sql)
          ? statement.all(Object.fromEntries(values.map((value, i) => [`?${i + 1}`, value])))
          : statement.all(...values);
        return { all: async () => ({ results: rows() }), run: async () => { rows(); return { success: true }; } };
      } };
    },
  };
  const insert = db.prepare(`INSERT INTO churches (slug, name, country, location, status, display_score,
    spotify_playlist_ids, denomination) VALUES (?, ?, 'Sweden', 'Stockholm', ?, ?, ?, ?)`);
  const names = ["Bethel", "Alpha", "Zion", "Alpha", "Cornerstone", "Grace", "Hope", "Alpha", "Mosaic", "Bethel",
    "Life", "Elim", "Faith", "Calvary", "Saddleback", "Redeemer", "Vineyard", "Trinity", "Oasis", "Kingdom", "Nova"];
  names.forEach((name, i) => {
    const slug = `${name.toLowerCase()}-${String(i).padStart(2, "0")}`;
    const indexable = i % 3 !== 2;
    insert.run(slug, name, i === 5 ? "archived" : "approved", indexable ? 80 : 10,
      JSON.stringify(indexable ? ["playlist"] : []), null);
  });
  expected = db.prepare(`SELECT slug FROM churches WHERE status = 'approved' AND json_array_length(spotify_playlist_ids) > 0
    ORDER BY name, slug`).all().map((row) => row.slug);
});

afterEach(() => { db.close(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("sitemap church seed with keyset chunks", () => {
  it("one pass gives the total and the first church of every chunk", async () => {
    const index = await fetchSitemapChurchSeedIndexFromDb(4);
    expect(index.total).toBe(expected.length);
    expect(index.boundaries.map((boundary) => boundary.slug)).toEqual(expected.filter((_, i) => i % 4 === 0));
  });

  it("each chunk holds exactly the churches the offset chunk held, in order", async () => {
    const index = await fetchSitemapChurchSeedIndexFromDb(4);
    for (const [k, boundary] of index.boundaries.entries()) {
      const chunk = await fetchSitemapChurchSeedChunkFromDb(boundary, 4);
      expect(chunk.map((church) => church.slug), `chunk ${k}`).toEqual(expected.slice(k * 4, k * 4 + 4));
    }
  });

  it("slices and the count read through the cached index", async () => {
    await expect(getSitemapChurchSeedCountAsync()).resolves.toBe(expected.length);
    for (const [offset, limit] of [[0, 5], [3, 7], [10, 50]]) {
      const slice = await getSitemapChurchSeedSliceAsync(offset, limit);
      expect(slice.map((church) => church.slug)).toEqual(expected.slice(offset, offset + limit));
    }
  });
});
