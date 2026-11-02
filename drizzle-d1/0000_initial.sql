CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`userId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`idToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`password` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_provider_account_unique` ON `account` (`providerId`,`accountId`);--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `account` (`userId`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`token` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`userId`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`emailVerified` integer DEFAULT false NOT NULL,
	`image` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE UNIQUE INDEX `verification_identifier_value_unique` ON `verification` (`identifier`,`value`);--> statement-breakpoint
CREATE TABLE `app_kv` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `app_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`value` integer DEFAULT 1 NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `app_rate_limits_expires_at_idx` ON `app_rate_limits` (`expires_at`);--> statement-breakpoint
CREATE TABLE `church_campuses` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', (random() & 3) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))) NOT NULL,
	`slug` text NOT NULL,
	`network_id` text NOT NULL,
	`name` text NOT NULL,
	`city` text,
	`country` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`discovered_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`network_id`) REFERENCES `church_networks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `church_campuses_slug_unique` ON `church_campuses` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_campuses_network` ON `church_campuses` (`network_id`);--> statement-breakpoint
CREATE INDEX `idx_campuses_status` ON `church_campuses` (`status`);--> statement-breakpoint
CREATE INDEX `idx_campuses_country` ON `church_campuses` (`country`);--> statement-breakpoint
CREATE TABLE `church_candidate_playlist_reviews` (
	`candidate_id` text NOT NULL,
	`playlist_id` text NOT NULL,
	`status` text DEFAULT 'kept' NOT NULL,
	`reviewed_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`candidate_id`, `playlist_id`),
	FOREIGN KEY (`candidate_id`) REFERENCES `church_candidates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `church_candidates` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', (random() & 3) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))) NOT NULL,
	`name` text NOT NULL,
	`spotify_owner_id` text,
	`spotify_playlist_ids` text DEFAULT '[]' NOT NULL,
	`website` text,
	`contact_email` text,
	`location` text,
	`country` text,
	`confidence` real DEFAULT 0,
	`reason` text,
	`discovered_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`source` text DEFAULT 'spotify-search' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`merged_slug` text
);
--> statement-breakpoint
CREATE TABLE `church_claims` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', (random() & 3) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))) NOT NULL,
	`church_slug` text NOT NULL,
	`name` text NOT NULL,
	`role` text,
	`email` text NOT NULL,
	`message` text,
	`submitted_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `church_enrichment_payload_chunks` (
	`enrichment_id` text NOT NULL,
	`field` text NOT NULL,
	`part` integer NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`enrichment_id`, `field`, `part`),
	FOREIGN KEY (`enrichment_id`) REFERENCES `church_enrichments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `church_enrichments` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', (random() & 3) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))) NOT NULL,
	`church_slug` text,
	`candidate_id` text,
	`campus_id` text,
	`official_church_name` text,
	`street_address` text,
	`google_maps_url` text,
	`latitude` real,
	`longitude` real,
	`service_times` text,
	`theological_orientation` text,
	`denomination_network` text,
	`languages` text,
	`phone` text,
	`contact_email` text,
	`website_url` text,
	`instagram_url` text,
	`facebook_url` text,
	`youtube_url` text,
	`children_ministry` integer,
	`youth_ministry` integer,
	`ministries` text,
	`church_size` text,
	`cover_image_url` text,
	`logo_image_url` text,
	`seo_description` text,
	`summary` text,
	`pastor_name` text,
	`pastor_title` text,
	`livestream_url` text,
	`giving_url` text,
	`what_to_expect` text,
	`pastor_photo_url` text,
	`service_duration_minutes` integer,
	`parking_info` text,
	`good_fit_tags` text DEFAULT '[]',
	`visitor_faq` text DEFAULT '[]',
	`google_rating` real,
	`google_reviews_count` integer,
	`google_place_id` text,
	`amenities` text,
	`photo_urls` text,
	`raw_website_markdown` text,
	`raw_google_places` text,
	`raw_crawled_pages` text,
	`sources` text,
	`enrichment_status` text DEFAULT 'pending' NOT NULL,
	`confidence` real DEFAULT 0 NOT NULL,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`last_enriched_at` integer,
	`facebook_followers` integer,
	`instagram_followers` integer,
	`youtube_subscribers` integer,
	`social_stats_fetched_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`campus_id`) REFERENCES `church_campuses`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `church_enrichments_church_slug_unique` ON `church_enrichments` (`church_slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `church_enrichments_candidate_id_unique` ON `church_enrichments` (`candidate_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `church_enrichments_campus_id_unique` ON `church_enrichments` (`campus_id`);--> statement-breakpoint
CREATE INDEX `idx_church_enrichments_google_rating` ON `church_enrichments` (`google_rating`) WHERE "church_enrichments"."google_rating" is not null;--> statement-breakpoint
CREATE INDEX `idx_church_enrichments_lat_lng` ON `church_enrichments` (`latitude`,`longitude`);--> statement-breakpoint
CREATE INDEX `idx_enrichments_slug` ON `church_enrichments` (`church_slug`);--> statement-breakpoint
CREATE INDEX `idx_enrichments_candidate` ON `church_enrichments` (`candidate_id`);--> statement-breakpoint
CREATE INDEX `idx_enrichments_status` ON `church_enrichments` (`enrichment_status`);--> statement-breakpoint
CREATE TABLE `church_feedback` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', (random() & 3) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))) NOT NULL,
	`church_slug` text NOT NULL,
	`kind` text NOT NULL,
	`playlist_url` text,
	`field` text,
	`message` text NOT NULL,
	`submitted_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`source` text DEFAULT 'public' NOT NULL,
	`submitted_by_name` text,
	`submitted_by_email` text
);
--> statement-breakpoint
CREATE TABLE `church_followers` (
	`church_slug` text NOT NULL,
	`email` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`church_slug`, `email`)
);
--> statement-breakpoint
CREATE TABLE `church_memberships` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', (random() & 3) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))) NOT NULL,
	`church_slug` text NOT NULL,
	`email` text NOT NULL,
	`user_id` text,
	`full_name` text,
	`role` text DEFAULT 'owner' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`claim_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`claim_id`) REFERENCES `church_claims`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `church_memberships_church_slug_email_unique` ON `church_memberships` (`church_slug`,`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `church_memberships_church_slug_user_unique` ON `church_memberships` (`church_slug`,`user_id`) WHERE "church_memberships"."user_id" is not null;--> statement-breakpoint
CREATE INDEX `church_memberships_church_slug_idx` ON `church_memberships` (`church_slug`);--> statement-breakpoint
CREATE INDEX `church_memberships_user_id_idx` ON `church_memberships` (`user_id`);--> statement-breakpoint
CREATE TABLE `church_networks` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', (random() & 3) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))) NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`logo_url` text,
	`website` text,
	`parent_church_slug` text,
	`founded` integer,
	`headquarters_country` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `church_networks_slug_unique` ON `church_networks` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_networks_parent` ON `church_networks` (`parent_church_slug`);--> statement-breakpoint
CREATE TABLE `church_outreach` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', (random() & 3) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))) NOT NULL,
	`church_slug` text NOT NULL,
	`email` text NOT NULL,
	`sent_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`status` text DEFAULT 'sent' NOT NULL,
	`claim_id` text,
	FOREIGN KEY (`claim_id`) REFERENCES `church_claims`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `church_playlist_reviews` (
	`church_slug` text NOT NULL,
	`playlist_id` text NOT NULL,
	`status` text DEFAULT 'kept' NOT NULL,
	`reviewed_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`church_slug`, `playlist_id`),
	FOREIGN KEY (`church_slug`) REFERENCES `churches`(`slug`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `church_profile_edits` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', (random() & 3) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))) NOT NULL,
	`church_slug` text NOT NULL,
	`submitted_by` text NOT NULL,
	`field_name` text NOT NULL,
	`field_value` text NOT NULL,
	`review_status` text DEFAULT 'pending' NOT NULL,
	`reviewed_by` text,
	`reviewed_at` integer,
	`rejection_reason` text,
	`enrichment_match` text,
	`submitted_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_profile_edits_slug` ON `church_profile_edits` (`church_slug`);--> statement-breakpoint
CREATE INDEX `idx_profile_edits_status` ON `church_profile_edits` (`review_status`);--> statement-breakpoint
CREATE INDEX `idx_profile_edits_submitted_by` ON `church_profile_edits` (`submitted_by`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_profile_edits_pending` ON `church_profile_edits` (`church_slug`,`field_name`);--> statement-breakpoint
CREATE TABLE `church_songs` (
	`church_slug` text NOT NULL,
	`rank` integer NOT NULL,
	`title` text NOT NULL,
	`artist_name` text NOT NULL,
	`art_url` text,
	`adoption_count` integer DEFAULT 0 NOT NULL,
	`spotify_track_id` text,
	`playlist_church_url` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`church_slug`, `rank`),
	FOREIGN KEY (`church_slug`) REFERENCES `churches`(`slug`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `church_suggestions` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', (random() & 3) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))) NOT NULL,
	`name` text NOT NULL,
	`city` text,
	`country` text,
	`website` text,
	`contact_email` text,
	`denomination` text,
	`language` text,
	`playlist_url` text NOT NULL,
	`message` text,
	`submitted_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`enrichment_data` text
);
--> statement-breakpoint
CREATE TABLE `church_update_items` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', (random() & 3) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))) NOT NULL,
	`church_slug` text NOT NULL,
	`source_id` text NOT NULL,
	`external_id` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`summary` text,
	`published_at` integer,
	`source_kind` text NOT NULL,
	`source_label` text,
	`image_url` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `church_update_sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_church_update_items_unique` ON `church_update_items` (`church_slug`,`external_id`);--> statement-breakpoint
CREATE INDEX `idx_church_update_items_source` ON `church_update_items` (`source_id`);--> statement-breakpoint
CREATE TABLE `church_update_sources` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', (random() & 3) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))) NOT NULL,
	`church_slug` text NOT NULL,
	`source_kind` text NOT NULL,
	`source_value` text NOT NULL,
	`source_url` text,
	`source_label` text,
	`is_primary` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`last_checked_at` integer,
	`last_success_at` integer,
	`last_error` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_church_update_sources_unique` ON `church_update_sources` (`church_slug`,`source_kind`,`source_value`);--> statement-breakpoint
CREATE INDEX `idx_church_update_sources_slug` ON `church_update_sources` (`church_slug`);--> statement-breakpoint
CREATE TABLE `church_vote_events` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', (random() & 3) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))) NOT NULL,
	`slug` text NOT NULL,
	`ip_hash` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `church_vote_events_slug_created_idx` ON `church_vote_events` (`slug`,`created_at`);--> statement-breakpoint
CREATE INDEX `church_vote_events_ip_idx` ON `church_vote_events` (`ip_hash`);--> statement-breakpoint
CREATE TABLE `church_vote_totals` (
	`slug` text PRIMARY KEY NOT NULL,
	`votes` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `church_website_tech` (
	`church_slug` text PRIMARY KEY NOT NULL,
	`website_url` text NOT NULL,
	`final_url` text,
	`http_status` integer,
	`primary_platform` text,
	`technologies` text DEFAULT '[]' NOT NULL,
	`sales_angle` text,
	`has_donate_page` integer,
	`has_blog` integer,
	`has_podcast` integer,
	`has_app` integer,
	`outreach_notes` text,
	`error` text,
	`detection_version` integer DEFAULT 1 NOT NULL,
	`last_checked_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`church_slug`) REFERENCES `churches`(`slug`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `churches` (
	`slug` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`country` text DEFAULT '' NOT NULL,
	`location` text,
	`denomination` text,
	`founded` integer,
	`website` text,
	`email` text,
	`language` text,
	`logo` text,
	`header_image` text,
	`header_image_attribution` text,
	`spotify_url` text,
	`spotify_playlist_ids` text DEFAULT '[]' NOT NULL,
	`additional_playlists` text DEFAULT '[]' NOT NULL,
	`spotify_playlists` text,
	`music_style` text,
	`notable_artists` text,
	`youtube_channel_id` text,
	`spotify_artist_ids` text,
	`youtube_videos` text,
	`aliases` text,
	`source_kind` text DEFAULT 'manual' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`candidate_id` text,
	`reason` text,
	`confidence` real DEFAULT 1,
	`discovery_source` text,
	`discovered_at` integer,
	`spotify_owner_id` text,
	`last_researched` integer,
	`verified_at` integer,
	`show_email_publicly` integer DEFAULT false NOT NULL,
	`display_score` integer,
	`city_slug` text,
	`directory_score` real,
	`directory_ready` integer,
	`directory_rank` integer,
	`claim_preview_token` text,
	`spotify_searched_at` integer,
	`youtube_searched_at` integer,
	`phone` text,
	`facebook_url` text,
	`instagram_url` text,
	`tiktok_url` text,
	`apple_podcast_url` text,
	`donate_url` text,
	`service_times` text,
	`website_extracted_at` integer,
	`related_church_slugs` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "chk_churches_status" CHECK("churches"."status" in ('pending', 'approved', 'rejected', 'archived')),
	CONSTRAINT "chk_churches_source_kind" CHECK("churches"."source_kind" in ('manual', 'suggested', 'discovered', 'claimed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `churches_claim_preview_token_key` ON `churches` (`claim_preview_token`);--> statement-breakpoint
CREATE INDEX `idx_churches_spotify_unsearched` ON `churches` (`spotify_searched_at`) WHERE "churches"."spotify_url" is null;--> statement-breakpoint
CREATE INDEX `idx_churches_youtube_unsearched` ON `churches` (`youtube_searched_at`) WHERE "churches"."youtube_channel_id" is null;--> statement-breakpoint
CREATE INDEX `idx_churches_website_unscraped` ON `churches` (`website_extracted_at`) WHERE "churches"."website" is not null and "churches"."website_extracted_at" is null;--> statement-breakpoint
CREATE INDEX `idx_churches_status` ON `churches` (`status`);--> statement-breakpoint
CREATE INDEX `idx_churches_display_score` ON `churches` (`status`,`display_score`);--> statement-breakpoint
CREATE INDEX `idx_churches_status_city_slug` ON `churches` (`status`,`city_slug`);--> statement-breakpoint
CREATE INDEX `idx_churches_status_directory_score` ON `churches` (`status`,`directory_score`);--> statement-breakpoint
CREATE INDEX `idx_churches_status_directory_rank` ON `churches` (`status`,`directory_rank`);--> statement-breakpoint
CREATE INDEX `churches_status_name_slug_idx` ON `churches` (`status`,`name`,`slug`);--> statement-breakpoint
CREATE INDEX `idx_churches_country` ON `churches` (`country`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_churches_candidate_id` ON `churches` (`candidate_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_churches_spotify_owner_id` ON `churches` (`spotify_owner_id`);--> statement-breakpoint
CREATE TABLE `prayers` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', (random() & 3) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))) NOT NULL,
	`church_slug` text NOT NULL,
	`content` text NOT NULL,
	`original_content` text,
	`author_name` text,
	`prayed_count` integer DEFAULT 0 NOT NULL,
	`moderated` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_prayers_church` ON `prayers` (`church_slug`);--> statement-breakpoint
CREATE INDEX `idx_prayers_created` ON `prayers` (`created_at`);--> statement-breakpoint
CREATE TABLE `search_suggestions` (
	`suggestion_key` text PRIMARY KEY NOT NULL,
	`target_type` text DEFAULT 'church' NOT NULL,
	`target_id` text NOT NULL,
	`title` text NOT NULL,
	`subtitle` text,
	`slug` text NOT NULL,
	`search_key` text NOT NULL,
	`popularity` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `search_suggestions_search_key_prefix_idx` ON `search_suggestions` (`search_key`);--> statement-breakpoint
CREATE INDEX `search_suggestions_target_idx` ON `search_suggestions` (`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `search_suggestions_popularity_idx` ON `search_suggestions` (`popularity`);--> statement-breakpoint
CREATE TABLE `video_moved_events` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', (random() & 3) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))) NOT NULL,
	`video_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `video_moved_events_video_created_idx` ON `video_moved_events` (`video_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `video_moved_totals` (
	`video_id` text PRIMARY KEY NOT NULL,
	`moved_count` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
