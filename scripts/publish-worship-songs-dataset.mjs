#!/usr/bin/env node
/**
 * Publish the Worship Songs 2026 dataset to Hugging Face, Zenodo (draft), and
 * Kaggle, from data-release-worship/. Each target is isolated; one failure
 * does not block the others.
 *
 *   node scripts/export-worship-songs-dataset.mjs      # build the bundle first
 *   node scripts/publish-worship-songs-dataset.mjs     # all three
 *   node scripts/publish-worship-songs-dataset.mjs hf zenodo   # subset
 *
 * Env: HUGGINGFACE_TOKEN, ZENODO_TOKEN (.env.local). Kaggle uses ~/.kaggle/kaggle.json.
 * Zenodo creates a DRAFT only (never mints a DOI); publish it from the Zenodo UI.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, rmSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRepo, uploadFiles, whoAmI } from "@huggingface/hub";
import { loadLocalEnv } from "./lib/local-env.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadLocalEnv(ROOT);
const RELEASE = join(ROOT, "data-release-worship");

const REPORT_URL = "https://gospelchannel.com/worship-songs-2026";
const HF_REPO = process.env.HF_DATASET_REPO || "ac0ai/worship-songs-2026";
const KAGGLE_ID = "gospelchannel/worship-songs-2026";

const DATA_FILES = ["top_songs.csv", "top_artists.csv", "worship_houses.csv", "charts_by_country.csv", "themes.csv", "snapshot.json"];
const DOC_FILES = ["README.md", "CITATION.cff", "LICENSE"];

const targets = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const want = (t) => targets.length === 0 || targets.includes(t);

function assertBundle() {
  for (const f of DATA_FILES) if (!existsSync(join(RELEASE, "data", f))) throw new Error(`Missing data/${f}. Run export-worship-songs-dataset.mjs first.`);
  for (const f of DOC_FILES) if (!existsSync(join(RELEASE, f))) throw new Error(`Missing ${f}. Run export-worship-songs-dataset.mjs first.`);
}

const HF_FRONTMATTER = `---
license: cc-by-4.0
language:
  - en
pretty_name: "Worship Songs 2026 — Church-Playlist Adoption"
tags:
  - music
  - religion
  - worship
  - church
  - open-data
size_categories:
  - n<1K
---

`;

async function publishHuggingFace() {
  const TOKEN = process.env.HUGGINGFACE_TOKEN || process.env.HF_TOKEN;
  if (!TOKEN) throw new Error("Missing HUGGINGFACE_TOKEN");
  const repo = { type: "dataset", name: HF_REPO };
  const me = await whoAmI({ accessToken: TOKEN });
  console.log(`  HF user: ${me.name}`);
  try {
    await createRepo({ repo, accessToken: TOKEN, license: "cc-by-4.0", private: false });
    console.log("  repo created");
  } catch (err) {
    if (String(err.message || err).match(/already (created|exist)|409/i)) console.log("  repo exists, committing on top");
    else throw err;
  }
  const readme = HF_FRONTMATTER + readFileSync(join(RELEASE, "README.md"), "utf8");
  const files = [
    { path: "README.md", content: new Blob([readme], { type: "text/markdown" }) },
    ...DATA_FILES.map((f) => ({ path: f, content: new Blob([readFileSync(join(RELEASE, "data", f))]) })),
    ...["CITATION.cff", "LICENSE"].map((f) => ({ path: f, content: new Blob([readFileSync(join(RELEASE, f))]) })),
  ];
  await uploadFiles({
    repo, accessToken: TOKEN, files,
    commitTitle: "Initial release: Worship Songs 2026 dataset",
    commitDescription: `Church-playlist worship-song adoption across 825 churches. Companion report: ${REPORT_URL}`,
  });
  const url = `https://huggingface.co/datasets/${HF_REPO}`;
  console.log(`  ✓ ${url}`);
  return url;
}

async function zApi(TOKEN, method, path, { json, body, headers } = {}) {
  const url = path.startsWith("http") ? path : `https://zenodo.org/api${path}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, ...(json ? { "Content-Type": "application/json" } : {}), ...(headers || {}) },
    body: json ? JSON.stringify(json) : body,
  });
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

async function publishZenodoDraft() {
  const TOKEN = process.env.ZENODO_TOKEN;
  if (!TOKEN) throw new Error("Missing ZENODO_TOKEN");
  const METADATA = {
    metadata: {
      title: "Worship Songs 2026: church-playlist adoption across 825 churches",
      upload_type: "dataset",
      description: [
        "<p>An observed-data dataset of which worship songs churches actually sing, measured from the real,",
        "church-curated Spotify worship playlists of 825 churches across 31 countries. A church is counted as",
        "singing a song when the track appears in one of its worship playlists. No survey, no AI-inferred labels.</p>",
        `<p><strong>Companion report and methodology:</strong> <a href="${REPORT_URL}">${REPORT_URL}</a></p>`,
        "<p><strong>Selection bias:</strong> every church here publishes a Spotify worship playlist, so the sample",
        "skews contemporary, English-speaking, and Protestant, with most churches in the US and UK. It is a map of",
        "the modern-worship repertoire, not a census of all churches.</p>",
        '<p>License: <a href="https://creativecommons.org/licenses/by/4.0/">CC-BY-4.0</a>.</p>',
      ].join(" "),
      creators: [{ name: "GospelChannel", affiliation: "GospelChannel.com" }],
      access_right: "open",
      license: "cc-by-4.0",
      keywords: ["worship", "church music", "contemporary worship", "congregational singing", "CCLI", "open data"],
      language: "eng",
      version: "1.0.0",
      related_identifiers: [{ identifier: REPORT_URL, relation: "isDocumentedBy", resource_type: "publication-other" }],
      notes: "Corrections or catalog removals: press at gospelchannel.com.",
    },
  };
  const dep = await zApi(TOKEN, "POST", "/deposit/depositions", { json: {} });
  const bucket = dep.links.bucket;
  for (const f of [...DATA_FILES.map((n) => [join(RELEASE, "data", n), n]), ...DOC_FILES.map((n) => [join(RELEASE, n), n])]) {
    const [p, name] = f;
    await zApi(TOKEN, "PUT", `${bucket}/${name}`, { body: readFileSync(p), headers: { "Content-Type": "application/octet-stream" } });
    console.log(`  uploaded ${name} (${statSync(p).size} b)`);
  }
  await zApi(TOKEN, "PUT", `/deposit/depositions/${dep.id}`, { json: METADATA });
  console.log(`  ✓ DRAFT created (NOT published — mint the DOI from the UI)`);
  console.log(`  ${dep.links.html}`);
  return dep.links.html;
}

function stageAndCreateKaggle() {
  const STAGE = join(RELEASE, ".kaggle-stage");
  rmSync(STAGE, { recursive: true, force: true });
  mkdirSync(STAGE, { recursive: true });
  for (const f of DATA_FILES) copyFileSync(join(RELEASE, "data", f), join(STAGE, f));
  const meta = {
    title: "Worship Songs 2026 — What Churches Actually Sing",
    subtitle: "Worship-song adoption across 825 real church Spotify playlists, 31 countries",
    id: KAGGLE_ID,
    licenses: [{ name: "CC-BY-4.0" }],
    keywords: ["music", "religion and belief systems", "social science"],
    description:
      "Which worship songs do churches actually sing? Measured from the real, church-curated Spotify worship " +
      "playlists of 825 churches across 31 countries. Companion report and methodology:\n" +
      `${REPORT_URL}\n\nLive chart: https://playlist.church\n\nLicense: CC-BY-4.0\n`,
  };
  writeFileSync(join(STAGE, "dataset-metadata.json"), JSON.stringify(meta, null, 2));
  const res = spawnSync("kaggle", ["datasets", "create", "-p", STAGE, "--dir-mode", "zip"], { encoding: "utf8", shell: true });
  process.stdout.write(res.stdout || "");
  if (res.stderr) process.stdout.write(res.stderr);
  if (res.status !== 0) throw new Error(`kaggle datasets create exited ${res.status}. Staged at ${STAGE} for a manual retry.`);
  console.log(`  ✓ https://www.kaggle.com/datasets/${KAGGLE_ID}`);
  return `https://www.kaggle.com/datasets/${KAGGLE_ID}`;
}

async function main() {
  assertBundle();
  const results = {};
  const run = async (name, fn) => {
    console.log(`\n== ${name} ==`);
    try { results[name] = await fn(); } catch (e) { results[name] = `FAILED: ${e.message}`; console.log(`  ✘ ${e.message}`); }
  };
  if (want("hf")) await run("huggingface", publishHuggingFace);
  if (want("zenodo")) await run("zenodo", publishZenodoDraft);
  if (want("kaggle")) await run("kaggle", async () => stageAndCreateKaggle());
  console.log("\n=== RESULTS ===");
  for (const [k, v] of Object.entries(results)) console.log(`  ${k}: ${v}`);
}

main().catch((e) => { console.error(`Fatal: ${e.message}`); process.exit(1); });
