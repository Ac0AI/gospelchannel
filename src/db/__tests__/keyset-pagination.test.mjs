import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

// Full-index reads page by key instead of LIMIT/OFFSET. The pages must add up
// to exactly the rows, in the order, a single ordered query returns.

const context = vi.hoisted(() => ({ binding: null }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: () => ({ env: { GOSPEL_D1: context.binding } }) }));
vi.mock("next/cache", () => ({ unstable_cache: (fn) => fn, revalidateTag: vi.fn() }));
vi.mock("server-only", () => ({}));

import { _getChurchIndexData, fetchAllRowsByKey } from "@/lib/church";

let db;
beforeEach(() => {
  vi.stubEnv("GOSPEL_D1_DATABASE_ID", "");
  vi.stubEnv("GOSPEL_BUILD_OFFLINE", "0");
  db = new DatabaseSync(":memory:");
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
        return { all: async () => ({ results: rows() }), run: async () => { rows(); return { success: true }; } };
      } };
    },
  };
  const church = db.prepare(`INSERT INTO churches (slug, name, country, location, status) VALUES (?, ?, 'Sweden', 'Stockholm', ?)`);
  const names = ["Alpha", "Beta", "Alpha", "Gamma", "Beta", "Delta", "Alpha", "Epsilon", "Zeta", "Eta", "Theta"];
  names.forEach((name, i) => church.run(`c-${String(i).padStart(2, "0")}`, name, i === 4 ? "archived" : "approved"));
  const enrichment = db.prepare(`INSERT INTO church_enrichments (id, church_slug, summary, enrichment_status) VALUES (?, ?, ?, 'complete')`);
  names.forEach((_, i) => enrichment.run(`e-${String(10 - i).padStart(2, "0")}`, `c-${String(i).padStart(2, "0")}`, `Summary ${i}`));
});

afterEach(() => { db.close(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("keyset pagination", () => {
  it("pages add up to the ordered query for every page size", async () => {
    const expected = db.prepare(`SELECT slug FROM churches WHERE status = 'approved' ORDER BY name, slug`).all().map((r) => r.slug);
    for (const pageSize of [1, 2, 3, 4, 10, 1000]) {
      const rows = await fetchAllRowsByKey({ table: "churches", columns: "slug, name", where: "status = 'approved'", keys: ["name", "slug"], pageSize });
      expect(rows.map((r) => r.slug), `page size ${pageSize}`).toEqual(expected);
    }
  });

  it("the full index reads every approved church and its enrichment", async () => {
    const index = await _getChurchIndexData({ strict: true });
    expect(index.map((church) => church.slug).sort()).toEqual(
      db.prepare(`SELECT slug FROM churches WHERE status = 'approved'`).all().map((r) => r.slug).sort(),
    );
  });

  it("surfaces the database error instead of a generic message", async () => {
    await expect(fetchAllRowsByKey({ table: "no_such_table", columns: "a", where: "1", keys: ["a", "b"] }))
      .rejects.toThrow(/no such table/);
  });
});
