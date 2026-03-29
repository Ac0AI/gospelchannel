import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AnyPgTable } from "drizzle-orm/pg-core";
import { getDb, getSql, schema } from "../src/db";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

const MANAGED_TABLES = [
  "churches",
  "churchClaims",
  "churchSuggestions",
  "churchFeedback",
  "churchCandidates",
  "churchCandidatePlaylistReviews",
  "churchNetworks",
  "churchCampuses",
  "churchEnrichments",
  "churchMemberships",
  "churchProfileEdits",
  "churchOutreach",
  "churchPlaylistReviews",
  "churchFollowers",
  "prayers",
  "churchUpdateSources",
  "churchUpdateItems",
  "churchWebsiteTech",
  "churchVoteTotals",
  "churchVoteEvents",
  "videoMovedTotals",
  "videoMovedEvents",
  "appRateLimits",
] as const;

const TABLE_FILE_NAMES: Record<(typeof MANAGED_TABLES)[number], string> = {
  churches: "churches",
  churchClaims: "church_claims",
  churchSuggestions: "church_suggestions",
  churchFeedback: "church_feedback",
  churchCandidates: "church_candidates",
  churchCandidatePlaylistReviews: "church_candidate_playlist_reviews",
  churchNetworks: "church_networks",
  churchCampuses: "church_campuses",
  churchEnrichments: "church_enrichments",
  churchMemberships: "church_memberships",
  churchProfileEdits: "church_profile_edits",
  churchOutreach: "church_outreach",
  churchPlaylistReviews: "church_playlist_reviews",
  churchFollowers: "church_followers",
  prayers: "prayers",
  churchUpdateSources: "church_update_sources",
  churchUpdateItems: "church_update_items",
  churchWebsiteTech: "church_website_tech",
  churchVoteTotals: "church_vote_totals",
  churchVoteEvents: "church_vote_events",
  videoMovedTotals: "video_moved_totals",
  videoMovedEvents: "video_moved_events",
  appRateLimits: "app_rate_limits",
};

const TABLE_MAP: Record<(typeof MANAGED_TABLES)[number], AnyPgTable> = {
  churches: schema.churches,
  churchClaims: schema.churchClaims,
  churchSuggestions: schema.churchSuggestions,
  churchFeedback: schema.churchFeedback,
  churchCandidates: schema.churchCandidates,
  churchCandidatePlaylistReviews: schema.churchCandidatePlaylistReviews,
  churchNetworks: schema.churchNetworks,
  churchCampuses: schema.churchCampuses,
  churchEnrichments: schema.churchEnrichments,
  churchMemberships: schema.churchMemberships,
  churchProfileEdits: schema.churchProfileEdits,
  churchOutreach: schema.churchOutreach,
  churchPlaylistReviews: schema.churchPlaylistReviews,
  churchFollowers: schema.churchFollowers,
  prayers: schema.prayers,
  churchUpdateSources: schema.churchUpdateSources,
  churchUpdateItems: schema.churchUpdateItems,
  churchWebsiteTech: schema.churchWebsiteTech,
  churchVoteTotals: schema.churchVoteTotals,
  churchVoteEvents: schema.churchVoteEvents,
  videoMovedTotals: schema.videoMovedTotals,
  videoMovedEvents: schema.videoMovedEvents,
  appRateLimits: schema.appRateLimits,
};

function getArgValue(flag: string): string | undefined {
  const direct = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  if (direct) {
    return direct.slice(flag.length + 1).trim();
  }

  const index = process.argv.findIndex((arg) => arg === flag);
  if (index >= 0) {
    return process.argv[index + 1]?.trim();
  }

  return undefined;
}

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

function chunkRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

function rewriteMediaUrl(value: string): string {
  const mediaBase = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL || "https://media.gospelchannel.com").replace(/\/$/, "");
  const match = value.match(/\/storage\/v1\/object\/public\/church-assets\/(.+)$/);
  if (!match) {
    return value;
  }
  return `${mediaBase}/${match[1]}`;
}

function normalizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return rewriteMediaUrl(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeValue(entry));
  }

  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, normalizeValue(entry)]),
    );
  }

  return value;
}

function toCamelCaseKey(value: string): string {
  return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function maybeConvertTopLevelDate(key: string, value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return value;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed;
}

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      const camelKey = toCamelCaseKey(key);
      return [camelKey, maybeConvertTopLevelDate(camelKey, normalizeValue(value))];
    }),
  );
}

function readRowsFromFile(filePath: string): Record<string, unknown>[] {
  const source = readFileSync(filePath, "utf8").trim();
  if (!source) {
    return [];
  }

  if (filePath.endsWith(".jsonl") || filePath.endsWith(".ndjson")) {
    return source
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  }

  const parsed = JSON.parse(source) as unknown;
  if (Array.isArray(parsed)) {
    return parsed as Record<string, unknown>[];
  }

  if (parsed && typeof parsed === "object") {
    const maybeRows = (parsed as { rows?: unknown; data?: unknown }).rows ?? (parsed as { data?: unknown }).data;
    if (Array.isArray(maybeRows)) {
      return maybeRows as Record<string, unknown>[];
    }
  }

  throw new Error(`Unsupported export shape in ${filePath}`);
}

function findExportFile(exportDir: string, baseName: string): string | null {
  const candidates = [
    join(exportDir, `${baseName}.json`),
    join(exportDir, `${baseName}.jsonl`),
    join(exportDir, `${baseName}.ndjson`),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function maybeTruncateTables() {
  if (!process.argv.includes("--truncate")) {
    return;
  }

  const tableNames = MANAGED_TABLES
    .map((key) => TABLE_FILE_NAMES[key])
    .map((name) => quoteIdentifier(name))
    .join(", ");

  await getSql().query(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE`);
  console.log("[import:supabase] truncated managed tables");
}

async function importTable(tableKey: (typeof MANAGED_TABLES)[number], exportDir: string) {
  const db = getDb();
  const fileName = TABLE_FILE_NAMES[tableKey];
  const filePath = findExportFile(exportDir, fileName);

  if (!filePath) {
    console.log(`[import:supabase] skip ${fileName} (no export file)`);
    return;
  }

  const rows = readRowsFromFile(filePath).map((row) => normalizeRow(row));
  if (rows.length === 0) {
    console.log(`[import:supabase] skip ${fileName} (empty export)`);
    return;
  }

  for (const batch of chunkRows(rows, 200)) {
    await db.insert(TABLE_MAP[tableKey]).values(batch as never).onConflictDoNothing();
  }

  console.log(`[import:supabase] imported ${rows.length} rows into ${fileName}`);
}

async function main() {
  loadLocalEnv(ROOT_DIR);

  const exportDirValue = getArgValue("--dir")
    || process.env.SUPABASE_EXPORT_DIR
    || "tmp/supabase-export";
  const exportDir = resolve(ROOT_DIR, exportDirValue);

  if (!existsSync(exportDir)) {
    throw new Error(`Export directory not found: ${exportDir}`);
  }

  await maybeTruncateTables();

  for (const tableKey of MANAGED_TABLES) {
    await importTable(tableKey, exportDir);
  }

  console.log("[import:supabase] done");
}

main().catch((error) => {
  console.error("[import:supabase] failed", error);
  process.exit(1);
});
