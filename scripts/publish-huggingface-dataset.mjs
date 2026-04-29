#!/usr/bin/env node
/**
 * Publish the European Church Tech 2026 dataset to Hugging Face Hub.
 *
 * Creates the dataset repo if missing, prepends a HF dataset-card YAML
 * frontmatter to README.md so HF can auto-load the CSVs via
 * datasets.load_dataset(), and uploads all release artifacts in one
 * commit.
 *
 * Usage:
 *   node scripts/publish-huggingface-dataset.mjs                 # default repo
 *   HF_DATASET_REPO=ac0ai/foo node scripts/publish-huggingface-dataset.mjs
 *
 * Env:
 *   HUGGINGFACE_TOKEN   token with write scope (required)
 *   HF_DATASET_REPO     repo slug, defaults to ac0ai/european-church-tech-2026
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRepo, uploadFiles, whoAmI } from "@huggingface/hub";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const RELEASE = join(ROOT, "data-release");

loadLocalEnv(ROOT);

const TOKEN = process.env.HUGGINGFACE_TOKEN || process.env.HF_TOKEN;
const REPO_NAME = process.env.HF_DATASET_REPO || "ac0ai/european-church-tech-2026";

if (!TOKEN) {
  console.error("Missing HUGGINGFACE_TOKEN in env (.env.local).");
  process.exit(1);
}

const repo = { type: "dataset", name: REPO_NAME };

// HF dataset card YAML frontmatter. Drives auto-loading via
// datasets.load_dataset("ac0ai/european-church-tech-2026", "country_aggregates")
// and surfaces the right metadata in the HF UI.
const HF_FRONTMATTER = `---
license: cc-by-4.0
language:
  - en
pretty_name: European Church Tech 2026 — Observed Data
tags:
  - churches
  - europe
  - religion
  - digital-adoption
  - cms-detection
  - observational-data
  - open-data
size_categories:
  - n<1K
task_categories: []
configs:
  - config_name: country_aggregates
    data_files:
      - split: train
        path: country_aggregates.csv
  - config_name: platforms
    data_files:
      - split: train
        path: platforms.csv
source_datasets:
  - original
annotations_creators:
  - machine-generated
language_creators:
  - found
multilinguality:
  - monolingual
---

`;

const FLAT_TREE = `\`\`\`
country_aggregates.csv  # Per-country totals & coverage rates (19 rows)
platforms.csv           # CMS / web platform breakdown by country (138 rows)
snapshot.json           # Machine-readable metadata + countries + platforms
exploratory_analysis.ipynb  # Python load + first analysis (5 minutes)
\`\`\``;

const LOAD_SNIPPET = `## Load it

\`\`\`python
from datasets import load_dataset

countries = load_dataset("${REPO_NAME}", "country_aggregates", split="train")
platforms = load_dataset("${REPO_NAME}", "platforms", split="train")

print(f'{len(countries)} countries, {sum(c["total_churches"] for c in countries):,} churches measured')
\`\`\`

Or with pandas directly:

\`\`\`python
import pandas as pd
from huggingface_hub import hf_hub_download

countries = pd.read_csv(hf_hub_download(
    repo_id="${REPO_NAME}", filename="country_aggregates.csv", repo_type="dataset"
))
\`\`\`
`;

function adaptReadmeForHF(source) {
  // Replace the GitHub-shaped `data/ ... notebooks/` tree with a flat HF tree
  // and a HF-flavored Load it block (datasets + huggingface_hub paths).
  const treePattern = /```\s*\ndata\/\n[\s\S]*?notebooks\/\n[\s\S]*?```/m;
  if (!treePattern.test(source)) {
    throw new Error(
      "Could not find expected `data/ ... notebooks/` tree block in README. " +
      "Update the regex in publish-huggingface-dataset.mjs.",
    );
  }
  const flattened = source.replace(treePattern, `${FLAT_TREE}\n\n${LOAD_SNIPPET}`);
  return `${HF_FRONTMATTER}${flattened}`;
}

// Files to upload, flat layout (HF datasets are flat by default).
// RESPONSE_BANK.md intentionally excluded.
const UPLOADS = [
  ["data/country_aggregates.csv", "country_aggregates.csv"],
  ["data/platforms.csv", "platforms.csv"],
  ["data/snapshot.json", "snapshot.json"],
  ["FAQ.md", "FAQ.md"],
  ["KNOWN_LIMITATIONS.md", "KNOWN_LIMITATIONS.md"],
  ["CITATION.cff", "CITATION.cff"],
  ["LICENSE", "LICENSE"],
  ["notebooks/exploratory_analysis.ipynb", "exploratory_analysis.ipynb"],
];

async function main() {
  for (const [src] of UPLOADS) {
    if (!existsSync(join(RELEASE, src))) {
      throw new Error(
        `Missing ${src}. Run scripts/export-european-church-tech-dataset.mjs first.`,
      );
    }
  }
  if (!existsSync(join(RELEASE, "README.md"))) {
    throw new Error("Missing data-release/README.md.");
  }

  const me = await whoAmI({ accessToken: TOKEN });
  console.log(`HF user: ${me.name} (auth: ${me.auth?.accessToken?.role || "?"})\n`);

  console.log(`→ Ensuring dataset repo huggingface.co/datasets/${REPO_NAME} exists…`);
  try {
    await createRepo({
      repo,
      accessToken: TOKEN,
      license: "cc-by-4.0",
      private: false,
    });
    console.log("  created");
  } catch (err) {
    if (String(err.message || err).match(/already (created|exist)|409/i)) {
      console.log("  already exists, will commit on top");
    } else {
      throw err;
    }
  }

  const readme = adaptReadmeForHF(readFileSync(join(RELEASE, "README.md"), "utf8"));

  const files = [
    {
      path: "README.md",
      content: new Blob([readme], { type: "text/markdown" }),
    },
    ...UPLOADS.map(([src, dest]) => ({
      path: dest,
      content: new Blob([readFileSync(join(RELEASE, src))]),
    })),
  ];

  console.log(`→ Uploading ${files.length} files in one commit…`);
  for (const f of files) {
    console.log(`    ${f.path} (${f.content.size} bytes)`);
  }

  await uploadFiles({
    repo,
    accessToken: TOKEN,
    files,
    commitTitle: "Initial release: European Church Tech 2026 dataset",
    commitDescription:
      "Country-level + platform-by-country aggregates across 12,624 churches in 19 European countries. " +
      "DOI: 10.5281/zenodo.19882722. Companion report: https://gospelchannel.com/european-church-tech-2026",
  });

  console.log(`\n✓ Published`);
  console.log(`  https://huggingface.co/datasets/${REPO_NAME}`);
}

main().catch((err) => {
  console.error(`\n✘ ${err.message}`);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
