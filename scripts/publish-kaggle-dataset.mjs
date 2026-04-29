#!/usr/bin/env node
/**
 * Stage the European Church Tech 2026 dataset for Kaggle upload.
 *
 * Reads CSVs + snapshot.json from data-release/data/ and writes a flat,
 * Kaggle-shaped copy to data-release/.kaggle-stage/, plus a Kaggle-tuned
 * README and dataset-metadata.json.
 *
 * After staging:
 *   cd data-release/.kaggle-stage
 *   kaggle datasets version -m "<message>"
 *
 * The flat layout means /kaggle/input/<slug>/country_aggregates.csv works
 * with a one-level glob — researchers don't need recursive=True.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SRC = join(ROOT, "data-release", "data");
const STAGE = join(ROOT, "data-release", ".kaggle-stage");
const REPO_README = join(ROOT, "data-release", "README.md");

const FILES = ["country_aggregates.csv", "platforms.csv", "snapshot.json"];

const KAGGLE_METADATA = {
  title: "European Church Tech 2026 — Observed Data",
  subtitle:
    "Digital adoption across 12,624 evangelical churches in 19 European countries",
  description:
    "First measured (not surveyed) dataset on digital adoption among European " +
    "evangelical and Protestant churches. Country-level and platform-by-country " +
    "aggregates derived from observed signals across 12,624 churches in 19 " +
    "countries: website presence, detected CMS / web platform, Facebook URL, " +
    "YouTube channel URL, and confirmed livestream URL.\n\n" +
    "Companion report and methodology:\n" +
    "https://gospelchannel.com/european-church-tech-2026\n\n" +
    "Source code and replication:\n" +
    "https://github.com/Ac0AI/european-church-tech-2026\n\n" +
    "License: CC-BY-4.0\n",
  id: "gospelchannel/european-church-tech-2026-observed-data",
  // Kaggle's CLI license validator is restrictive. CC-BY-4.0 (Attribution
  // only, no ShareAlike) is set on the dataset via the web UI; we match the
  // canonical name Kaggle returns from the API so `--update` won't error.
  licenses: [{ name: "Attribution 4.0 International (CC BY 4.0)" }],
  // Kaggle has a controlled tag vocabulary. Stick to ones we've confirmed
  // are accepted by the API; widen later if needed via the web UI.
  keywords: [
    "europe",
    "internet",
    "websites",
    "religion and belief systems",
    "social science",
  ],
  resources: [
    {
      path: "country_aggregates.csv",
      description:
        "Per-country totals and digital-adoption rates across approved churches in 19 European countries. One row per country. Coverage rates are derived as (churches with detected signal) / (total approved churches in country).",
      schema: {
        fields: [
          { name: "country", description: "Country name in English.", type: "string" },
          {
            name: "total_churches",
            description: "Total approved churches mapped in this country at snapshot time.",
            type: "integer",
          },
          {
            name: "with_website",
            description: "Churches with at least one detected website URL (catalog or Google Places).",
            type: "integer",
          },
          {
            name: "pct_website",
            description: "Share of churches with a website, 0–100.",
            type: "number",
          },
          {
            name: "with_cms_detected",
            description: "Churches where a primary CMS / web platform was identified by HTTP fingerprinting.",
            type: "integer",
          },
          {
            name: "pct_cms_detected",
            description: "Share with an identified CMS / web platform, 0–100.",
            type: "number",
          },
          {
            name: "with_facebook",
            description: "Churches with a detected Facebook page URL (catalog or LLM-extracted from website).",
            type: "integer",
          },
          {
            name: "pct_facebook",
            description: "Share with Facebook presence, 0–100.",
            type: "number",
          },
          {
            name: "with_youtube",
            description: "Churches with a detected YouTube channel URL or channel ID.",
            type: "integer",
          },
          {
            name: "pct_youtube",
            description: "Share with YouTube presence, 0–100.",
            type: "number",
          },
          {
            name: "with_livestream",
            description: "Churches with a confirmed livestream URL on their profile.",
            type: "integer",
          },
          {
            name: "pct_livestream",
            description: "Share with livestream, 0–100.",
            type: "number",
          },
        ],
      },
    },
    {
      path: "platforms.csv",
      description:
        "CMS / web platform breakdown by country. One row per (country, platform) pair where at least one church was detected on that platform. Use this for platform-share analyses (e.g. WordPress dominance, modern-DIY mix).",
      schema: {
        fields: [
          { name: "country", description: "Country name in English.", type: "string" },
          {
            name: "platform",
            description:
              "Detected primary web platform — examples: WordPress, Squarespace, Wix, Webflow, Subsplash, Joomla. Detection is HTTP fingerprint based; see KNOWN_LIMITATIONS for caveats.",
            type: "string",
          },
          {
            name: "count",
            description: "Number of approved churches in this country detected on this platform.",
            type: "integer",
          },
        ],
      },
    },
    {
      path: "snapshot.json",
      description:
        "Machine-readable snapshot containing the same country aggregates and platform breakdowns as the CSVs, plus generation metadata (generatedAt, version, methodology summary, license, source URLs). Use when you want a single self-describing artifact instead of two CSVs.",
    },
    {
      path: "README.md",
      description:
        "Human-readable dataset documentation: methodology, ethics, known limitations, and a Python load-it snippet. Same content as the GitHub repo's README, with a Kaggle-flat path layout.",
    },
  ],
};

const LOAD_SNIPPET = `## Load it

\`\`\`python
import glob, os
import pandas as pd

DATA_PATH = os.path.dirname(glob.glob('/kaggle/input/*/country_aggregates.csv')[0])
countries = pd.read_csv(f'{DATA_PATH}/country_aggregates.csv')
platforms = pd.read_csv(f'{DATA_PATH}/platforms.csv')

print(f'{len(countries)} countries, {countries["total_churches"].sum():,} churches measured')
\`\`\`
`;

const FLAT_TREE = `\`\`\`
country_aggregates.csv  # Per-country totals & coverage rates (19 rows)
platforms.csv           # CMS / web platform breakdown by country (138 rows)
snapshot.json           # Machine-readable metadata + countries + platforms
\`\`\``;

function adaptReadme(source) {
  // Strip the GitHub-shaped file tree (with data/ + notebooks/ subfolders)
  // and replace with a flat Kaggle tree + a "Load it" snippet right under it.
  const treePattern =
    /```\s*\ndata\/\n[\s\S]*?notebooks\/\n[\s\S]*?```/m;
  if (!treePattern.test(source)) {
    throw new Error(
      "Could not find expected `data/ ... notebooks/` tree block in README. " +
        "Update the regex in publish-kaggle-dataset.mjs to match the new structure.",
    );
  }
  return source.replace(treePattern, `${FLAT_TREE}\n\n${LOAD_SNIPPET}`);
}

function main() {
  for (const f of FILES) {
    if (!existsSync(join(SRC, f))) {
      throw new Error(
        `Missing ${f} in ${SRC}. Run scripts/export-european-church-tech-dataset.mjs first.`,
      );
    }
  }

  mkdirSync(STAGE, { recursive: true });

  for (const f of FILES) {
    copyFileSync(join(SRC, f), join(STAGE, f));
    console.log(`  copied ${f}`);
  }

  const readme = adaptReadme(readFileSync(REPO_README, "utf8"));
  writeFileSync(join(STAGE, "README.md"), readme);
  console.log("  wrote README.md (Kaggle-flavored)");

  writeFileSync(
    join(STAGE, "dataset-metadata.json"),
    `${JSON.stringify(KAGGLE_METADATA, null, 2)}\n`,
  );
  console.log("  wrote dataset-metadata.json");

  console.log(`\n✓ Staged at ${STAGE}`);
  console.log("\nNext:");
  console.log("  pip install kaggle    # if needed");
  console.log(`  cd ${STAGE}`);
  console.log('  kaggle datasets version -m "Flatten layout: CSVs at root"');
}

main();
