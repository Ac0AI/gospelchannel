#!/usr/bin/env node
/**
 * Publish the European Church Tech 2026 dataset to Zenodo for a citable DOI.
 *
 * Default behavior: creates a DRAFT deposition and uploads files. Review the
 * draft in the Zenodo UI before publishing. Pass --publish to publish in one
 * shot; pass --sandbox to target sandbox.zenodo.org for dry-runs.
 *
 * Usage:
 *   node scripts/publish-zenodo-dataset.mjs                 # draft on prod
 *   node scripts/publish-zenodo-dataset.mjs --sandbox       # draft on sandbox
 *   node scripts/publish-zenodo-dataset.mjs --publish       # draft + publish
 *
 * Env:
 *   ZENODO_TOKEN          token for zenodo.org (required unless --sandbox)
 *   ZENODO_SANDBOX_TOKEN  separate token for sandbox.zenodo.org (optional)
 */
import { readFileSync, statSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const RELEASE = join(ROOT, "data-release");

loadLocalEnv(ROOT);

const args = new Set(process.argv.slice(2));
const SANDBOX = args.has("--sandbox");
const PUBLISH = args.has("--publish");

const API = SANDBOX
  ? "https://sandbox.zenodo.org/api"
  : "https://zenodo.org/api";

const TOKEN = SANDBOX
  ? process.env.ZENODO_SANDBOX_TOKEN || process.env.ZENODO_TOKEN
  : process.env.ZENODO_TOKEN;

if (!TOKEN) {
  console.error(
    `Missing ${SANDBOX ? "ZENODO_SANDBOX_TOKEN or ZENODO_TOKEN" : "ZENODO_TOKEN"} in env (.env.local).`,
  );
  process.exit(1);
}

// Files to upload, in order. Flat layout — Zenodo buckets don't support
// folders. RESPONSE_BANK.md is intentionally excluded (internal-only copy).
const UPLOADS = [
  ["data/country_aggregates.csv", "country_aggregates.csv"],
  ["data/platforms.csv", "platforms.csv"],
  ["data/snapshot.json", "snapshot.json"],
  ["README.md", "README.md"],
  ["FAQ.md", "FAQ.md"],
  ["KNOWN_LIMITATIONS.md", "KNOWN_LIMITATIONS.md"],
  ["CITATION.cff", "CITATION.cff"],
  ["LICENSE", "LICENSE"],
  ["notebooks/exploratory_analysis.ipynb", "exploratory_analysis.ipynb"],
];

const METADATA = {
  metadata: {
    title:
      "European Church Tech 2026: an observed-data dataset on digital adoption across 12,624 European churches",
    upload_type: "dataset",
    description: [
      "<p>First observed-data (not survey) dataset on digital adoption among",
      "European evangelical and Protestant churches. Country-level and",
      "platform-by-country aggregates derived from publicly observable signals",
      "across 12,624 churches in 19 countries: website presence, detected CMS /",
      "web platform, Facebook URL, YouTube channel URL, and confirmed",
      "livestream URL.</p>",
      "<p><strong>Companion report and methodology:</strong>",
      '<a href="https://gospelchannel.com/european-church-tech-2026">',
      "https://gospelchannel.com/european-church-tech-2026</a></p>",
      "<p><strong>Aggregates only.</strong> Per-church platform detections are",
      "the operational layer of the enrichment pipeline and are not released",
      "openly. Country aggregates are sufficient for journalist citations,",
      "academic comparisons, and benchmark work.</p>",
      "<p>License: <a href=\"https://creativecommons.org/licenses/by/4.0/\">",
      "CC-BY-4.0</a>. See README.md for methodology, ethics, and limitations.</p>",
    ].join(" "),
    creators: [
      {
        name: "GospelChannel",
        affiliation: "GospelChannel.com",
      },
    ],
    access_right: "open",
    license: "cc-by-4.0",
    keywords: [
      "churches",
      "europe",
      "digital adoption",
      "religion",
      "web platforms",
      "content management systems",
      "observational data",
      "open data",
      "evangelical",
      "protestant",
    ],
    language: "eng",
    version: "1.0.0",
    related_identifiers: [
      {
        identifier: "https://gospelchannel.com/european-church-tech-2026",
        relation: "isDocumentedBy",
        resource_type: "publication-other",
      },
      {
        identifier:
          "https://www.kaggle.com/datasets/gospelchannel/european-church-tech-2026-observed-data",
        relation: "isIdenticalTo",
        resource_type: "dataset",
      },
    ],
    notes:
      "Catalog removals or corrections: hello@gospelchannel.com. We process catalog removals within 7 days; future dataset versions reflect lower country counts.",
  },
};

async function api(method, path, { json, body, headers } = {}) {
  const url = path.startsWith("http") ? path : `${API}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(json ? { "Content-Type": "application/json" } : {}),
      ...(headers || {}),
    },
    body: json ? JSON.stringify(json) : body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${url} → ${res.status}: ${text}`);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

async function main() {
  // Sanity-check files
  for (const [src] of UPLOADS) {
    const path = join(RELEASE, src);
    if (!existsSync(path)) {
      throw new Error(
        `Missing ${src}. Run scripts/export-european-church-tech-dataset.mjs first.`,
      );
    }
  }

  console.log(
    `\n${SANDBOX ? "SANDBOX" : "PRODUCTION"} Zenodo · ${API}\n`,
  );

  console.log("→ Creating draft deposition…");
  const dep = await api("POST", "/deposit/depositions", { json: {} });
  const id = dep.id;
  const bucket = dep.links.bucket;
  console.log(`  id=${id}`);
  console.log(`  bucket=${bucket}`);

  for (const [src, name] of UPLOADS) {
    const path = join(RELEASE, src);
    const data = readFileSync(path);
    const size = statSync(path).size;
    process.stdout.write(`  uploading ${name} (${size} bytes)… `);
    await api("PUT", `${bucket}/${name}`, {
      body: data,
      headers: { "Content-Type": "application/octet-stream" },
    });
    process.stdout.write("ok\n");
  }

  console.log("→ Setting metadata…");
  await api("PUT", `/deposit/depositions/${id}`, { json: METADATA });

  if (PUBLISH) {
    console.log("→ Publishing…");
    const published = await api(
      "POST",
      `/deposit/depositions/${id}/actions/publish`,
    );
    console.log(`\n✓ Published`);
    console.log(`  DOI: ${published.doi}`);
    console.log(`  URL: ${published.links.html}`);
  } else {
    console.log(`\n✓ Draft created (NOT published)`);
    console.log(`  Review and publish: ${dep.links.html}`);
    console.log(`  Or re-run with --publish to publish in one shot.`);
  }
}

main().catch((err) => {
  console.error(`\n✘ ${err.message}`);
  process.exit(1);
});
