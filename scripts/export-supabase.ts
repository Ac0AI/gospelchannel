import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

const TABLES = [
  "churches",
  "church_claims",
  "church_suggestions",
  "church_feedback",
  "church_candidates",
  "church_candidate_playlist_reviews",
  "church_networks",
  "church_campuses",
  "church_enrichments",
  "church_memberships",
  "church_profile_edits",
  "church_outreach",
  "church_playlist_reviews",
  "church_followers",
  "prayers",
  "church_update_sources",
  "church_update_items",
  "church_website_tech",
  "church_vote_totals",
  "church_vote_events",
  "video_moved_totals",
  "video_moved_events",
  "app_rate_limits",
] as const;

const ORDER_COLUMNS: Partial<Record<(typeof TABLES)[number], string>> = {
  churches: "slug",
  church_claims: "id",
  church_suggestions: "id",
  church_feedback: "id",
  church_candidates: "id",
  church_candidate_playlist_reviews: "candidate_id",
  church_networks: "slug",
  church_campuses: "slug",
  church_enrichments: "id",
  church_memberships: "id",
  church_profile_edits: "id",
  church_outreach: "id",
  church_playlist_reviews: "church_slug",
  church_followers: "church_slug",
  prayers: "id",
  church_update_sources: "id",
  church_update_items: "id",
  church_website_tech: "church_slug",
  church_vote_totals: "slug",
  church_vote_events: "id",
  video_moved_totals: "video_id",
  video_moved_events: "id",
  app_rate_limits: "key",
};

const PAGE_SIZE = 1000;

function getArgValue(flag: string): string | undefined {
  const direct = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  if (direct) return direct.slice(flag.length + 1).trim();

  const index = process.argv.findIndex((arg) => arg === flag);
  if (index >= 0) return process.argv[index + 1]?.trim();

  return undefined;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function buildTableUrl(baseUrl: string, table: string, offset: number): URL {
  const url = new URL(`/rest/v1/${table}`, baseUrl);
  url.searchParams.set("select", "*");
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("offset", String(offset));

  const orderColumn = ORDER_COLUMNS[table as keyof typeof ORDER_COLUMNS];
  if (orderColumn) {
    url.searchParams.set("order", `${orderColumn}.asc`);
  }

  return url;
}

async function fetchTableRows(baseUrl: string, secretKey: string, table: string) {
  const rows: Record<string, unknown>[] = [];
  let offset = 0;

  while (true) {
    const url = buildTableUrl(baseUrl, table, offset);
    const response = await fetch(url, {
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      if (response.status === 404 && body.includes("PGRST205")) {
        console.log(`[export:supabase] skip ${table} (table missing in Supabase)`);
        return null;
      }
      throw new Error(`Failed to export ${table}: ${response.status} ${body}`);
    }

    const page = (await response.json()) as Record<string, unknown>[];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }

    offset += PAGE_SIZE;
  }

  return rows;
}

async function main() {
  loadLocalEnv(ROOT_DIR);

  const baseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const secretKey = getRequiredEnv("SUPABASE_SECRET_KEY");
  const exportDirValue = getArgValue("--dir") || process.env.SUPABASE_EXPORT_DIR || "tmp/supabase-export";
  const exportDir = resolve(ROOT_DIR, exportDirValue);

  mkdirSync(exportDir, { recursive: true });

  for (const table of TABLES) {
    const rows = await fetchTableRows(baseUrl, secretKey, table);
    if (!rows) {
      continue;
    }
    const outputPath = join(exportDir, `${table}.json`);
    writeFileSync(outputPath, JSON.stringify(rows, null, 2));
    console.log(`[export:supabase] wrote ${rows.length} rows to ${outputPath}`);
  }

  console.log("[export:supabase] done");
}

main().catch((error) => {
  console.error("[export:supabase] failed", error);
  process.exit(1);
});
