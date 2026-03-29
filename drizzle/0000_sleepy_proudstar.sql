CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp with time zone,
	"refreshTokenExpiresAt" timestamp with time zone,
	"scope" text,
	"password" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"token" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"value" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "church_campuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"network_id" uuid NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"country" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"discovered_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "church_candidate_playlist_reviews" (
	"candidate_id" uuid NOT NULL,
	"playlist_id" text NOT NULL,
	"status" text DEFAULT 'kept' NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "church_candidate_playlist_reviews_candidate_id_playlist_id_pk" PRIMARY KEY("candidate_id","playlist_id")
);
--> statement-breakpoint
CREATE TABLE "church_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"spotify_owner_id" text,
	"spotify_playlist_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"website" text,
	"contact_email" text,
	"location" text,
	"country" text,
	"confidence" real DEFAULT 0,
	"reason" text,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text DEFAULT 'spotify-search' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"merged_slug" text
);
--> statement-breakpoint
CREATE TABLE "church_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_slug" text NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"email" text NOT NULL,
	"message" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "church_enrichments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_slug" text,
	"candidate_id" uuid,
	"campus_id" uuid,
	"official_church_name" text,
	"street_address" text,
	"google_maps_url" text,
	"latitude" real,
	"longitude" real,
	"service_times" jsonb,
	"theological_orientation" text,
	"denomination_network" text,
	"languages" text[],
	"phone" text,
	"contact_email" text,
	"website_url" text,
	"instagram_url" text,
	"facebook_url" text,
	"youtube_url" text,
	"children_ministry" boolean,
	"youth_ministry" boolean,
	"ministries" text[],
	"church_size" text,
	"cover_image_url" text,
	"logo_image_url" text,
	"seo_description" text,
	"summary" text,
	"raw_website_markdown" text,
	"raw_google_places" jsonb,
	"raw_crawled_pages" jsonb,
	"sources" jsonb,
	"enrichment_status" text DEFAULT 'pending' NOT NULL,
	"confidence" real DEFAULT 0 NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"last_enriched_at" timestamp with time zone,
	"facebook_followers" integer,
	"instagram_followers" integer,
	"youtube_subscribers" integer,
	"social_stats_fetched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "church_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_slug" text NOT NULL,
	"kind" text NOT NULL,
	"playlist_url" text,
	"field" text,
	"message" text NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"source" text DEFAULT 'public' NOT NULL,
	"submitted_by_name" text,
	"submitted_by_email" text
);
--> statement-breakpoint
CREATE TABLE "church_followers" (
	"church_slug" text NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "church_followers_church_slug_email_pk" PRIMARY KEY("church_slug","email")
);
--> statement-breakpoint
CREATE TABLE "church_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_slug" text NOT NULL,
	"email" text NOT NULL,
	"user_id" text,
	"full_name" text,
	"role" text DEFAULT 'owner' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"claim_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "church_networks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"logo_url" text,
	"website" text,
	"parent_church_slug" text,
	"founded" integer,
	"headquarters_country" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "church_outreach" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_slug" text NOT NULL,
	"email" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"claim_id" uuid
);
--> statement-breakpoint
CREATE TABLE "church_playlist_reviews" (
	"church_slug" text NOT NULL,
	"playlist_id" text NOT NULL,
	"status" text DEFAULT 'kept' NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "church_playlist_reviews_church_slug_playlist_id_pk" PRIMARY KEY("church_slug","playlist_id")
);
--> statement-breakpoint
CREATE TABLE "church_profile_edits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_slug" text NOT NULL,
	"submitted_by" text NOT NULL,
	"field_name" text NOT NULL,
	"field_value" jsonb NOT NULL,
	"review_status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"enrichment_match" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "church_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"country" text,
	"website" text,
	"contact_email" text,
	"denomination" text,
	"language" text,
	"playlist_url" text NOT NULL,
	"message" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "church_update_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_slug" text NOT NULL,
	"source_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"summary" text,
	"published_at" timestamp with time zone,
	"source_kind" text NOT NULL,
	"source_label" text,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "church_update_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_slug" text NOT NULL,
	"source_kind" text NOT NULL,
	"source_value" text NOT NULL,
	"source_url" text,
	"source_label" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "church_vote_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "church_vote_totals" (
	"slug" text PRIMARY KEY NOT NULL,
	"votes" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "church_website_tech" (
	"church_slug" text PRIMARY KEY NOT NULL,
	"website_url" text NOT NULL,
	"final_url" text,
	"http_status" integer,
	"primary_platform" text,
	"technologies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sales_angle" text,
	"error" text,
	"detection_version" integer DEFAULT 1 NOT NULL,
	"last_checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "churches" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"country" text DEFAULT '' NOT NULL,
	"location" text,
	"denomination" text,
	"founded" integer,
	"website" text,
	"email" text,
	"language" text,
	"logo" text,
	"header_image" text,
	"header_image_attribution" text,
	"spotify_url" text,
	"spotify_playlist_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"additional_playlists" text[] DEFAULT '{}'::text[] NOT NULL,
	"spotify_playlists" jsonb,
	"music_style" text[],
	"notable_artists" text[],
	"youtube_channel_id" text,
	"spotify_artist_ids" text[],
	"youtube_videos" jsonb,
	"aliases" text[],
	"source_kind" text DEFAULT 'manual' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"candidate_id" uuid,
	"reason" text,
	"confidence" real DEFAULT 1,
	"discovery_source" text,
	"discovered_at" timestamp with time zone,
	"spotify_owner_id" text,
	"last_researched" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_churches_status" CHECK ("churches"."status" in ('pending', 'approved', 'rejected')),
	CONSTRAINT "chk_churches_source_kind" CHECK ("churches"."source_kind" in ('manual', 'suggested', 'discovered', 'claimed'))
);
--> statement-breakpoint
CREATE TABLE "prayers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_slug" text NOT NULL,
	"content" text NOT NULL,
	"original_content" text,
	"author_name" text,
	"prayed_count" integer DEFAULT 0 NOT NULL,
	"moderated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_moved_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_moved_totals" (
	"video_id" text PRIMARY KEY NOT NULL,
	"moved_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "church_campuses" ADD CONSTRAINT "church_campuses_network_id_church_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."church_networks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "church_candidate_playlist_reviews" ADD CONSTRAINT "church_candidate_playlist_reviews_candidate_id_church_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."church_candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "church_enrichments" ADD CONSTRAINT "church_enrichments_campus_id_church_campuses_id_fk" FOREIGN KEY ("campus_id") REFERENCES "public"."church_campuses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "church_memberships" ADD CONSTRAINT "church_memberships_claim_id_church_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."church_claims"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "church_outreach" ADD CONSTRAINT "church_outreach_claim_id_church_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."church_claims"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "church_playlist_reviews" ADD CONSTRAINT "church_playlist_reviews_church_slug_churches_slug_fk" FOREIGN KEY ("church_slug") REFERENCES "public"."churches"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "church_update_items" ADD CONSTRAINT "church_update_items_source_id_church_update_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."church_update_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "church_website_tech" ADD CONSTRAINT "church_website_tech_church_slug_churches_slug_fk" FOREIGN KEY ("church_slug") REFERENCES "public"."churches"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_unique" ON "account" USING btree ("providerId","accountId");--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_unique" ON "session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_unique" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_identifier_value_unique" ON "verification" USING btree ("identifier","value");--> statement-breakpoint
CREATE INDEX "app_rate_limits_expires_at_idx" ON "app_rate_limits" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "church_campuses_slug_unique" ON "church_campuses" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_campuses_network" ON "church_campuses" USING btree ("network_id");--> statement-breakpoint
CREATE INDEX "idx_campuses_status" ON "church_campuses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_campuses_country" ON "church_campuses" USING btree ("country");--> statement-breakpoint
CREATE UNIQUE INDEX "church_enrichments_church_slug_unique" ON "church_enrichments" USING btree ("church_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "church_enrichments_candidate_id_unique" ON "church_enrichments" USING btree ("candidate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "church_enrichments_campus_id_unique" ON "church_enrichments" USING btree ("campus_id");--> statement-breakpoint
CREATE INDEX "idx_enrichments_slug" ON "church_enrichments" USING btree ("church_slug");--> statement-breakpoint
CREATE INDEX "idx_enrichments_candidate" ON "church_enrichments" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "idx_enrichments_status" ON "church_enrichments" USING btree ("enrichment_status");--> statement-breakpoint
CREATE UNIQUE INDEX "church_memberships_church_slug_email_unique" ON "church_memberships" USING btree ("church_slug","email");--> statement-breakpoint
CREATE INDEX "church_memberships_church_slug_idx" ON "church_memberships" USING btree ("church_slug");--> statement-breakpoint
CREATE INDEX "church_memberships_user_id_idx" ON "church_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "church_networks_slug_unique" ON "church_networks" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_networks_parent" ON "church_networks" USING btree ("parent_church_slug");--> statement-breakpoint
CREATE INDEX "idx_profile_edits_slug" ON "church_profile_edits" USING btree ("church_slug");--> statement-breakpoint
CREATE INDEX "idx_profile_edits_status" ON "church_profile_edits" USING btree ("review_status");--> statement-breakpoint
CREATE INDEX "idx_profile_edits_submitted_by" ON "church_profile_edits" USING btree ("submitted_by");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_profile_edits_pending" ON "church_profile_edits" USING btree ("church_slug","field_name");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_church_update_items_unique" ON "church_update_items" USING btree ("church_slug","external_id");--> statement-breakpoint
CREATE INDEX "idx_church_update_items_source" ON "church_update_items" USING btree ("source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_church_update_sources_unique" ON "church_update_sources" USING btree ("church_slug","source_kind","source_value");--> statement-breakpoint
CREATE INDEX "idx_church_update_sources_slug" ON "church_update_sources" USING btree ("church_slug");--> statement-breakpoint
CREATE INDEX "church_vote_events_slug_created_idx" ON "church_vote_events" USING btree ("slug","created_at");--> statement-breakpoint
CREATE INDEX "church_vote_events_ip_idx" ON "church_vote_events" USING btree ("ip_hash");--> statement-breakpoint
CREATE INDEX "idx_churches_status" ON "churches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_churches_country" ON "churches" USING btree ("country");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_churches_candidate_id" ON "churches" USING btree ("candidate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_churches_spotify_owner_id" ON "churches" USING btree ("spotify_owner_id");--> statement-breakpoint
CREATE INDEX "idx_prayers_church" ON "prayers" USING btree ("church_slug");--> statement-breakpoint
CREATE INDEX "idx_prayers_created" ON "prayers" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "video_moved_events_video_created_idx" ON "video_moved_events" USING btree ("video_id","created_at");