#!/usr/bin/env node

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/local-env.mjs";
import { buildApprovalDecision, resolveApprovedChurchName } from "./lib/church-approval.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const REASON_PREFIX = "directory-import: Every Nation | https://www.everynation.org/find-a-church/";

function parseArgs(argv) {
  const options = {
    preview: false,
    threshold: 70,
    regenerate: true,
  };

  for (const arg of argv) {
    if (arg === "--preview") options.preview = true;
    else if (arg === "--skip-regenerate") options.regenerate = false;
    else if (arg.startsWith("--min-score=")) options.threshold = Math.max(0, Number(arg.split("=")[1]) || 70);
  }

  return options;
}

function runGenerateSnapshot() {
  const result = spawnSync("node", ["scripts/generate-churches-json.mjs"], {
    cwd: ROOT_DIR,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    throw new Error("generate-churches-json failed");
  }
}

async function main() {
  loadLocalEnv(ROOT_DIR);
  const options = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;

  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL or DATABASE_URL_UNPOOLED");
  }

  const sql = neon(databaseUrl);
  const rows = await sql`
    select
      c.slug,
      c.name,
      c.website,
      c.email,
      c.location,
      c.country,
      c.header_image,
      c.confidence,
      e.id as enrichment_id,
      e.website_url,
      e.contact_email,
      e.facebook_url,
      e.cover_image_url,
      e.official_church_name,
      e.confidence as enrichment_confidence,
      e.street_address
    from churches c
    left join church_enrichments e on e.church_slug = c.slug
    where c.reason = ${REASON_PREFIX}
      and c.status = 'pending'
    order by c.country, c.name
  `;

  const decisions = rows.map((row) => {
    const decision = buildApprovalDecision(
      row,
      {
        enrichment: {
          website_url: row.website_url,
          contact_email: row.contact_email,
          facebook_url: row.facebook_url,
          cover_image_url: row.cover_image_url,
          official_church_name: row.official_church_name,
          confidence: row.enrichment_confidence,
          street_address: row.street_address,
        },
        screening: null,
        fetchedEmail: "",
        approvalThreshold: options.threshold,
      },
    );

    return { row, ...decision };
  });

  const approved = decisions.filter((entry) => entry.eligible);
  const blockerSummary = Object.create(null);
  for (const entry of decisions.filter((item) => !item.eligible)) {
    for (const blocker of entry.blockers) {
      blockerSummary[blocker] = (blockerSummary[blocker] || 0) + 1;
    }
  }

  console.log(`Pending reviewed: ${decisions.length}`);
  console.log(`Would approve: ${approved.length}`);
  console.log(JSON.stringify(blockerSummary, null, 2));
  console.log(JSON.stringify(
    approved.slice(0, 20).map((entry) => ({
      slug: entry.row.slug,
      name: entry.row.name,
      country: entry.row.country,
      location: entry.merged.location,
      score: entry.score,
      email: entry.merged.email || null,
      website: entry.merged.website || null,
      facebook: entry.merged.facebookUrl || null,
    })),
    null,
    2,
  ));

  if (options.preview || approved.length === 0) {
    console.log(options.preview ? "\nPreview mode: nothing written." : "\nNothing eligible for approval.");
    return;
  }

  const now = new Date().toISOString();

  for (const entry of approved) {
    const row = entry.row;
    const mergedName = resolveApprovedChurchName(row.name || "", row.official_church_name || "");

    await sql.query(
      `update churches
       set
         name = $1,
         status = 'approved',
         email = $2,
         location = $3,
         country = $4,
         website = $5,
         last_researched = $6,
         updated_at = now()
       where slug = $7`,
      [
        mergedName,
        entry.merged.email || row.email || null,
        row.location || entry.merged.location || null,
        row.country || entry.merged.country || null,
        entry.merged.website || row.website || null,
        now,
        row.slug,
      ],
    );

    const enrichmentFields = [];
    const enrichmentValues = [];

    if (entry.merged.email && !row.contact_email) {
      enrichmentFields.push(`contact_email = $${enrichmentValues.length + 1}`);
      enrichmentValues.push(entry.merged.email);
    }
    if (row.official_church_name) {
      enrichmentFields.push(`official_church_name = $${enrichmentValues.length + 1}`);
      enrichmentValues.push(row.official_church_name);
    }
    if (entry.merged.facebookUrl && !row.facebook_url) {
      enrichmentFields.push(`facebook_url = $${enrichmentValues.length + 1}`);
      enrichmentValues.push(entry.merged.facebookUrl);
    }
    if (entry.merged.website && !row.website_url) {
      enrichmentFields.push(`website_url = $${enrichmentValues.length + 1}`);
      enrichmentValues.push(entry.merged.website);
    }

    if (enrichmentFields.length > 0 && row.enrichment_id) {
      enrichmentValues.push(row.enrichment_id);
      await sql.query(
        `update church_enrichments
         set ${enrichmentFields.join(", ")}, updated_at = now()
         where id = $${enrichmentValues.length}`,
        enrichmentValues,
      );
    }
  }

  console.log(`\nApproved ${approved.length} Every Nation churches.`);

  if (options.regenerate) {
    console.log("\nRegenerating src/data/churches.json...");
    runGenerateSnapshot();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
