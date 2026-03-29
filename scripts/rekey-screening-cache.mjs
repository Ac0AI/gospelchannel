#!/usr/bin/env node

/**
 * Re-key screening cache from candidate UUID to church slug.
 * The screening JSON is an array of objects with .id (UUID).
 * Output: array with .slug replacing .id.
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

loadLocalEnv(ROOT_DIR);

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const cachePath = join(ROOT_DIR, "src/data/cache/church-candidate-screening.json");
const raw = await readFile(cachePath, "utf8");
const screeningArray = JSON.parse(raw);

console.log(`Loaded ${screeningArray.length} screening entries`);

// Build UUID → slug mapping from churches table
const { data: churches } = await sb
  .from("churches")
  .select("slug, candidate_id")
  .not("candidate_id", "is", null)
  .limit(2000);

const uuidToSlug = new Map();
for (const row of churches || []) {
  uuidToSlug.set(row.candidate_id, row.slug);
}

console.log(`Built UUID→slug mapping with ${uuidToSlug.size} entries`);

const result = [];
let mapped = 0;
let skipped = 0;

for (const entry of screeningArray) {
  const slug = uuidToSlug.get(entry.id);
  if (slug) {
    const { id, ...rest } = entry;
    result.push({ slug, ...rest });
    mapped++;
  } else {
    skipped++;
  }
}

await writeFile(cachePath, JSON.stringify(result, null, 2));
console.log(`Re-keyed ${mapped} entries by slug (${skipped} skipped - no matching church)`);
