import { readFile, mkdir, writeFile } from "node:fs/promises";

// Generate an experimental D1 schema from the current Drizzle PostgreSQL
// definitions. This does not change the application's database connection.
async function convert(name) {
  let source = await readFile(`src/db/schema/${name}.ts`, "utf8");
  const sqliteImports = name === "auth" ? "index, integer, sqliteTable, text, uniqueIndex" : "check, index, integer, primaryKey, real, sqliteTable, text, uniqueIndex";
  source = source.replace(/import \{[\s\S]*?\} from "drizzle-orm\/pg-core";/, `import { ${sqliteImports} } from "drizzle-orm/sqlite-core";`);
  source = source.replaceAll("pgTable(", "sqliteTable(");
  source = source.replace(/text\(("[^"]+")\)\.array\(\)/g, 'text($1, { mode: "json" }).$type<string[]>()');
  source = source.replace(/jsonb\(("[^"]+")\)/g, 'text($1, { mode: "json" })');
  source = source.replace(/boolean\(("[^"]+")\)/g, 'integer($1, { mode: "boolean" })');
  source = source.replace(/timestamp\(("[^"]+"), \{ withTimezone: true \}\)/g, 'integer($1, { mode: "timestamp_ms" })');
  source = source.replace(/uuid\(("[^"]+")\)/g, 'text($1)');
  // Raw SQL writers also rely on server-side UUID defaults.
  source = source.replaceAll(".defaultRandom()", ".default(sql`(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', (random() & 3) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))))`)");
  source = source.replaceAll(".defaultNow()", ".default(sql`(unixepoch() * 1000)`)");
  source = source.replaceAll("sql`'{}'::text[]`", "sql`'[]'`");
  source = source.replaceAll("sql`'[]'::jsonb`", "sql`'[]'`");
  // Several production columns are used by raw SQL but are not represented
  // in the Postgres Drizzle model. Keep them in the migration schema.
  if (name === "gospel") {
    source = source.replace('    relatedChurchSlugs:', `    claimPreviewToken: text("claim_preview_token"),
    spotifySearchedAt: integer("spotify_searched_at", { mode: "timestamp_ms" }),
    youtubeSearchedAt: integer("youtube_searched_at", { mode: "timestamp_ms" }),
    phone: text("phone"),
    facebookUrl: text("facebook_url"),
    instagramUrl: text("instagram_url"),
    tiktokUrl: text("tiktok_url"),
    applePodcastUrl: text("apple_podcast_url"),
    donateUrl: text("donate_url"),
    serviceTimes: text("service_times", { mode: "json" }),
    websiteExtractedAt: integer("website_extracted_at", { mode: "timestamp_ms" }),
    relatedChurchSlugs:`);
    source = source.replace('    rawWebsiteMarkdown:', `    pastorPhotoUrl: text("pastor_photo_url"),
    serviceDurationMinutes: integer("service_duration_minutes"),
    parkingInfo: text("parking_info"),
    goodFitTags: text("good_fit_tags", { mode: "json" }).$type<string[]>().default(sql\`'[]'\`),
    visitorFaq: text("visitor_faq", { mode: "json" }).default(sql\`'[]'\`),
    googleRating: real("google_rating"),
    googleReviewsCount: integer("google_reviews_count"),
    googlePlaceId: text("google_place_id"),
    amenities: text("amenities", { mode: "json" }),
    photoUrls: text("photo_urls", { mode: "json" }),
    rawWebsiteMarkdown:`);
    source = source.replace('    statusIndex: index("idx_churches_status")', `    claimPreviewTokenUnique: uniqueIndex("churches_claim_preview_token_key").on(table.claimPreviewToken),
    spotifyUnsearchedIndex: index("idx_churches_spotify_unsearched").on(table.spotifySearchedAt).where(sql\`\${table.spotifyUrl} is null\`),
    youtubeUnsearchedIndex: index("idx_churches_youtube_unsearched").on(table.youtubeSearchedAt).where(sql\`\${table.youtubeChannelId} is null\`),
    websiteUnscrapedIndex: index("idx_churches_website_unscraped").on(table.websiteExtractedAt).where(sql\`\${table.website} is not null and \${table.websiteExtractedAt} is null\`),
    statusIndex: index("idx_churches_status")`);
    source = source.replace('    slugIndex: index("idx_enrichments_slug")', `    ratingIndex: index("idx_church_enrichments_google_rating").on(table.googleRating).where(sql\`\${table.googleRating} is not null\`),
    locationIndex: index("idx_church_enrichments_lat_lng").on(table.latitude, table.longitude),
    slugIndex: index("idx_enrichments_slug")`);
    source = source.replace('    targetIndex: index("search_suggestions_target_idx")', `    searchKeyIndex: index("search_suggestions_search_key_prefix_idx").on(table.searchKey),
    targetIndex: index("search_suggestions_target_idx")`);
  }
  if (!source.includes('import { sql } from "drizzle-orm";')) {
    source = `import { sql } from "drizzle-orm";\n${source}`;
  }
  if (name === "gospel") {
    source += `\n// Oversized source payloads cannot fit within D1's 2 MB per-row limit.\nexport const churchEnrichmentPayloadChunks = sqliteTable("church_enrichment_payload_chunks", {\n  enrichmentId: text("enrichment_id").notNull().references(() => churchEnrichments.id, { onDelete: "cascade" }),\n  field: text("field").notNull(),\n  part: integer("part").notNull(),\n  value: text("value").notNull(),\n}, (table) => ({ pk: primaryKey({ columns: [table.enrichmentId, table.field, table.part] }) }));\n`;
  }
  if (/pgTable\(|\.array\(\)|defaultNow\(|defaultRandom\(|::jsonb|::text\[\]/.test(source)) throw new Error(`Unsupported Postgres syntax remains in ${name}`);
  await writeFile(`src/db/d1-schema/${name}.ts`, `// Generated by scripts/generate-d1-schema.mjs; canonical D1 schema.\n${source}`);
}

await mkdir("src/db/d1-schema", { recursive: true });
await convert("auth");
await convert("gospel");
await writeFile("src/db/d1-schema/index.ts", 'export * from "./auth";\nexport * from "./gospel";\n');
