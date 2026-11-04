-- Precomputed facet links: the related countries, cities, styles and
-- denominations (with church counts) for the whole directory ('all') and for
-- each country, style and denomination page. Computing them per request read
-- 300k-640k rows per query, several hundred times a day. Written nightly by
-- scripts/build-facet-links.ts with the same SQL the pages used
-- (fetchFacetRelatedLinks); read by src/lib/facet-links.ts. City pages still
-- compute theirs per request: bounded by the city through
-- idx_churches_status_city_slug.
--
-- A build writes a complete new generation, then points
-- app_kv['facet_links_generation'] at it, then deletes older generations, so
-- readers never see a half-written set.
CREATE TABLE `facet_links` (
	`generation` text NOT NULL,
	`source_kind` text NOT NULL,
	`source_slug` text NOT NULL,
	`target_kind` text NOT NULL,
	`position` integer NOT NULL,
	`target_slug` text NOT NULL,
	`label` text NOT NULL,
	`count` integer NOT NULL,
	PRIMARY KEY(`generation`, `source_kind`, `source_slug`, `target_kind`, `position`)
);
