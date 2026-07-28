#!/usr/bin/env node

// Overnight driver: runs the OSM importer across every LATAM country, sequentially,
// with a polite gap between Overpass queries. Each child writes on-brand churches
// (with coordinates) to Neon. Idempotent — safe to re-run. Logs a per-country tally.
//
//   node scripts/import-latam-overnight.mjs

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Ordered biggest-evangelical-opportunity first so the impressive numbers land early.
const COUNTRIES = ["BR", "MX", "GT", "CO", "AR", "PE", "CL", "VE", "EC", "HN", "SV", "NI", "BO", "PY", "DO", "CR", "PA", "UY", "PR", "CU"];

let grandTotal = 0;
for (const iso of COUNTRIES) {
  const t0 = Date.now();
  try {
    const { stdout } = await run("node", ["scripts/import-osm-churches.mjs", `--country=${iso}`, "--approve"], {
      cwd: ROOT, maxBuffer: 128 * 1024 * 1024,
    });
    const imp = Number((stdout.match(/Imported (\d+) churches/) || [])[1] || 0);
    const raw = Number((stdout.match(/Raw christian POW: (\d+)/) || [])[1] || 0);
    const ev = Number((stdout.match(/Evangelical \(on-brand\): (\d+)/) || [])[1] || 0);
    grandTotal += imp;
    console.log(`[${iso}] raw=${raw} evangelical=${ev} imported=${imp} (${Math.round((Date.now() - t0) / 1000)}s) | running total=${grandTotal}`);
  } catch (e) {
    console.log(`[${iso}] ERROR: ${String(e.message).slice(0, 200)}`);
  }
  await new Promise((r) => setTimeout(r, 8000)); // Overpass politeness between countries
}
console.log(`\nLATAM OSM overnight run complete. Total imported this run: ${grandTotal}`);
