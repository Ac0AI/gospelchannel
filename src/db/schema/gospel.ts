import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const churches = pgTable(
  "churches",
  {
    slug: text("slug").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    country: text("country").notNull().default(""),
    location: text("location"),
    denomination: text("denomination"),
    founded: integer("founded"),
    website: text("website"),
    email: text("email"),
    language: text("language"),
    logo: text("logo"),
    headerImage: text("header_image"),
    headerImageAttribution: text("header_image_attribution"),
    spotifyUrl: text("spotify_url"),
    spotifyPlaylistIds: text("spotify_playlist_ids").array().notNull().default(sql`'{}'::text[]`),
    additionalPlaylists: text("additional_playlists").array().notNull().default(sql`'{}'::text[]`),
    spotifyPlaylists: jsonb("spotify_playlists"),
    musicStyle: text("music_style").array(),
    notableArtists: text("notable_artists").array(),
    youtubeChannelId: text("youtube_channel_id"),
    spotifyArtistIds: text("spotify_artist_ids").array(),
    youtubeVideos: jsonb("youtube_videos"),
    aliases: text("aliases").array(),
    sourceKind: text("source_kind").notNull().default("manual"),
    status: text("status").notNull().default("pending"),
    candidateId: uuid("candidate_id"),
    reason: text("reason"),
    confidence: real("confidence").default(1),
    discoverySource: text("discovery_source"),
    discoveredAt: timestamp("discovered_at", { withTimezone: true }),
    spotifyOwnerId: text("spotify_owner_id"),
    lastResearched: timestamp("last_researched", { withTimezone: true }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    statusIndex: index("idx_churches_status").on(table.status),
    countryIndex: index("idx_churches_country").on(table.country),
    candidateUnique: uniqueIndex("idx_churches_candidate_id").on(table.candidateId),
    spotifyOwnerUnique: uniqueIndex("idx_churches_spotify_owner_id").on(table.spotifyOwnerId),
    statusCheck: check("chk_churches_status", sql`${table.status} in ('pending', 'approved', 'rejected', 'archived')`),
    sourceKindCheck: check(
      "chk_churches_source_kind",
      sql`${table.sourceKind} in ('manual', 'suggested', 'discovered', 'claimed')`,
    ),
  }),
);

export const churchSuggestions = pgTable("church_suggestions", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  city: text("city"),
  country: text("country"),
  website: text("website"),
  contactEmail: text("contact_email"),
  denomination: text("denomination"),
  language: text("language"),
  playlistUrl: text("playlist_url").notNull(),
  message: text("message"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("pending"),
});

export const churchFeedback = pgTable("church_feedback", {
  id: uuid("id").defaultRandom().primaryKey(),
  churchSlug: text("church_slug").notNull(),
  kind: text("kind").notNull(),
  playlistUrl: text("playlist_url"),
  field: text("field"),
  message: text("message").notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("pending"),
  source: text("source").notNull().default("public"),
  submittedByName: text("submitted_by_name"),
  submittedByEmail: text("submitted_by_email"),
});

export const churchClaims = pgTable("church_claims", {
  id: uuid("id").defaultRandom().primaryKey(),
  churchSlug: text("church_slug").notNull(),
  name: text("name").notNull(),
  role: text("role"),
  email: text("email").notNull(),
  message: text("message"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("pending"),
});

export const churchCandidates = pgTable("church_candidates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  spotifyOwnerId: text("spotify_owner_id"),
  spotifyPlaylistIds: text("spotify_playlist_ids").array().notNull().default(sql`'{}'::text[]`),
  website: text("website"),
  contactEmail: text("contact_email"),
  location: text("location"),
  country: text("country"),
  confidence: real("confidence").default(0),
  reason: text("reason"),
  discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
  source: text("source").notNull().default("spotify-search"),
  status: text("status").notNull().default("pending"),
  mergedSlug: text("merged_slug"),
});

export const churchCandidatePlaylistReviews = pgTable(
  "church_candidate_playlist_reviews",
  {
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => churchCandidates.id, { onDelete: "cascade" }),
    playlistId: text("playlist_id").notNull(),
    status: text("status").notNull().default("kept"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.candidateId, table.playlistId] }),
  }),
);

export const churchMemberships = pgTable(
  "church_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    churchSlug: text("church_slug").notNull(),
    email: text("email").notNull(),
    userId: text("user_id"),
    fullName: text("full_name"),
    role: text("role").notNull().default("owner"),
    status: text("status").notNull().default("active"),
    claimId: uuid("claim_id").references(() => churchClaims.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueMembership: uniqueIndex("church_memberships_church_slug_email_unique").on(table.churchSlug, table.email),
    churchIndex: index("church_memberships_church_slug_idx").on(table.churchSlug),
    userIndex: index("church_memberships_user_id_idx").on(table.userId),
  }),
);

export const churchNetworks = pgTable(
  "church_networks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    logoUrl: text("logo_url"),
    website: text("website"),
    parentChurchSlug: text("parent_church_slug"),
    founded: integer("founded"),
    headquartersCountry: text("headquarters_country"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    slugUnique: uniqueIndex("church_networks_slug_unique").on(table.slug),
    parentIndex: index("idx_networks_parent").on(table.parentChurchSlug),
  }),
);

export const churchCampuses = pgTable(
  "church_campuses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    networkId: uuid("network_id")
      .notNull()
      .references(() => churchNetworks.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    city: text("city"),
    country: text("country"),
    status: text("status").notNull().default("pending"),
    discoveredBy: text("discovered_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    slugUnique: uniqueIndex("church_campuses_slug_unique").on(table.slug),
    networkIndex: index("idx_campuses_network").on(table.networkId),
    statusIndex: index("idx_campuses_status").on(table.status),
    countryIndex: index("idx_campuses_country").on(table.country),
  }),
);

export const churchEnrichments = pgTable(
  "church_enrichments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    churchSlug: text("church_slug"),
    candidateId: uuid("candidate_id"),
    campusId: uuid("campus_id").references(() => churchCampuses.id, { onDelete: "set null" }),
    officialChurchName: text("official_church_name"),
    streetAddress: text("street_address"),
    googleMapsUrl: text("google_maps_url"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    serviceTimes: jsonb("service_times"),
    theologicalOrientation: text("theological_orientation"),
    denominationNetwork: text("denomination_network"),
    languages: text("languages").array(),
    phone: text("phone"),
    contactEmail: text("contact_email"),
    websiteUrl: text("website_url"),
    instagramUrl: text("instagram_url"),
    facebookUrl: text("facebook_url"),
    youtubeUrl: text("youtube_url"),
    childrenMinistry: boolean("children_ministry"),
    youthMinistry: boolean("youth_ministry"),
    ministries: text("ministries").array(),
    churchSize: text("church_size"),
    coverImageUrl: text("cover_image_url"),
    logoImageUrl: text("logo_image_url"),
    seoDescription: text("seo_description"),
    summary: text("summary"),
    pastorName: text("pastor_name"),
    pastorTitle: text("pastor_title"),
    livestreamUrl: text("livestream_url"),
    givingUrl: text("giving_url"),
    whatToExpect: text("what_to_expect"),
    rawWebsiteMarkdown: text("raw_website_markdown"),
    rawGooglePlaces: jsonb("raw_google_places"),
    rawCrawledPages: jsonb("raw_crawled_pages"),
    sources: jsonb("sources"),
    enrichmentStatus: text("enrichment_status").notNull().default("pending"),
    confidence: real("confidence").notNull().default(0),
    schemaVersion: integer("schema_version").notNull().default(1),
    lastEnrichedAt: timestamp("last_enriched_at", { withTimezone: true }),
    facebookFollowers: integer("facebook_followers"),
    instagramFollowers: integer("instagram_followers"),
    youtubeSubscribers: integer("youtube_subscribers"),
    socialStatsFetchedAt: timestamp("social_stats_fetched_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    churchSlugUnique: uniqueIndex("church_enrichments_church_slug_unique").on(table.churchSlug),
    candidateIdUnique: uniqueIndex("church_enrichments_candidate_id_unique").on(table.candidateId),
    campusIdUnique: uniqueIndex("church_enrichments_campus_id_unique").on(table.campusId),
    slugIndex: index("idx_enrichments_slug").on(table.churchSlug),
    candidateIndex: index("idx_enrichments_candidate").on(table.candidateId),
    statusIndex: index("idx_enrichments_status").on(table.enrichmentStatus),
  }),
);

export const churchProfileEdits = pgTable(
  "church_profile_edits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    churchSlug: text("church_slug").notNull(),
    submittedBy: text("submitted_by").notNull(),
    fieldName: text("field_name").notNull(),
    fieldValue: jsonb("field_value").notNull(),
    reviewStatus: text("review_status").notNull().default("pending"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    enrichmentMatch: text("enrichment_match"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    slugIndex: index("idx_profile_edits_slug").on(table.churchSlug),
    statusIndex: index("idx_profile_edits_status").on(table.reviewStatus),
    submittedByIndex: index("idx_profile_edits_submitted_by").on(table.submittedBy),
    pendingUnique: uniqueIndex("idx_profile_edits_pending").on(table.churchSlug, table.fieldName),
  }),
);

export const churchOutreach = pgTable("church_outreach", {
  id: uuid("id").defaultRandom().primaryKey(),
  churchSlug: text("church_slug").notNull(),
  email: text("email").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("sent"),
  claimId: uuid("claim_id").references(() => churchClaims.id, { onDelete: "set null" }),
});

export const churchPlaylistReviews = pgTable(
  "church_playlist_reviews",
  {
    churchSlug: text("church_slug")
      .notNull()
      .references(() => churches.slug, { onDelete: "cascade" }),
    playlistId: text("playlist_id").notNull(),
    status: text("status").notNull().default("kept"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.churchSlug, table.playlistId] }),
  }),
);

export const churchFollowers = pgTable(
  "church_followers",
  {
    churchSlug: text("church_slug").notNull(),
    email: text("email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.churchSlug, table.email] }),
  }),
);

export const prayers = pgTable(
  "prayers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    churchSlug: text("church_slug").notNull(),
    content: text("content").notNull(),
    originalContent: text("original_content"),
    authorName: text("author_name"),
    prayedCount: integer("prayed_count").notNull().default(0),
    moderated: boolean("moderated").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    churchIndex: index("idx_prayers_church").on(table.churchSlug),
    createdIndex: index("idx_prayers_created").on(table.createdAt),
  }),
);

export const churchUpdateSources = pgTable(
  "church_update_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    churchSlug: text("church_slug").notNull(),
    sourceKind: text("source_kind").notNull(),
    sourceValue: text("source_value").notNull(),
    sourceUrl: text("source_url"),
    sourceLabel: text("source_label"),
    isPrimary: boolean("is_primary").notNull().default(false),
    active: boolean("active").notNull().default(true),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueSource: uniqueIndex("idx_church_update_sources_unique").on(table.churchSlug, table.sourceKind, table.sourceValue),
    slugIndex: index("idx_church_update_sources_slug").on(table.churchSlug),
  }),
);

export const churchUpdateItems = pgTable(
  "church_update_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    churchSlug: text("church_slug").notNull(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => churchUpdateSources.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    summary: text("summary"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    sourceKind: text("source_kind").notNull(),
    sourceLabel: text("source_label"),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueItem: uniqueIndex("idx_church_update_items_unique").on(table.churchSlug, table.externalId),
    sourceIndex: index("idx_church_update_items_source").on(table.sourceId),
  }),
);

export const churchWebsiteTech = pgTable("church_website_tech", {
  churchSlug: text("church_slug")
    .primaryKey()
    .references(() => churches.slug, { onDelete: "cascade" }),
  websiteUrl: text("website_url").notNull(),
  finalUrl: text("final_url"),
  httpStatus: integer("http_status"),
  primaryPlatform: text("primary_platform"),
  technologies: jsonb("technologies").notNull().default(sql`'[]'::jsonb`),
  salesAngle: text("sales_angle"),
  error: text("error"),
  detectionVersion: integer("detection_version").notNull().default(1),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const churchVoteTotals = pgTable("church_vote_totals", {
  slug: text("slug").primaryKey(),
  votes: integer("votes").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const churchVoteEvents = pgTable(
  "church_vote_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    slugCreatedIndex: index("church_vote_events_slug_created_idx").on(table.slug, table.createdAt),
    ipIndex: index("church_vote_events_ip_idx").on(table.ipHash),
  }),
);

export const videoMovedTotals = pgTable("video_moved_totals", {
  videoId: text("video_id").primaryKey(),
  movedCount: integer("moved_count").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const videoMovedEvents = pgTable(
  "video_moved_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    videoId: text("video_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    videoCreatedIndex: index("video_moved_events_video_created_idx").on(table.videoId, table.createdAt),
  }),
);

export const appKv = pgTable("app_kv", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appRateLimits = pgTable(
  "app_rate_limits",
  {
    key: text("key").primaryKey(),
    value: integer("value").notNull().default(1),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    expiresAtIndex: index("app_rate_limits_expires_at_idx").on(table.expiresAt),
  }),
);
