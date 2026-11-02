import { randomUUID } from "node:crypto";

/** D1 executes this batch atomically; a stale version/claim aborts every write. */
export function buildOfficialReviewBatch(patches, before) {
  const guard = `review_guard_${randomUUID().replaceAll("-", "")}`;
  const payload = JSON.stringify(patches.map((patch) => {
    const old = before.find((row) => row.slug === patch.slug);
    if (!old) throw new Error(`Missing before-image: ${patch.slug}`);
    return { patch, churchVersion: Date.parse(old.church.updated_at),
      enrichmentVersion: Date.parse(old.enrichment.updated_at),
      checkedAt: Date.parse(`${patch.review.checkedAt}T00:00:00Z`),
      language: patch.languages.join(", ") || null };
  }));
  const assertion = { sql: `INSERT INTO ${guard} SELECT changes()`, params: [] };
  return [
    { sql: `CREATE TABLE ${guard} (affected INTEGER NOT NULL CHECK (affected = ${patches.length}))`, params: [] },
    { sql: `UPDATE churches AS c SET
        name = p.value->>'$.patch.name', description = p.value->>'$.patch.summary',
        website = p.value->>'$.patch.website', service_times = p.value->'$.patch.serviceTimes',
        denomination = p.value->>'$.patch.denomination', music_style = p.value->'$.patch.musicStyles',
        language = p.value->>'$.language', last_researched = p.value->>'$.checkedAt',
        updated_at = unixepoch() * 1000
      FROM json_each(?1) p WHERE c.slug = p.value->>'$.patch.slug'
        AND c.updated_at = p.value->>'$.churchVersion'
        AND c.status = 'approved' AND c.city_slug = 'austin' AND c.source_kind <> 'claimed'
        AND NOT EXISTS (SELECT 1 FROM church_memberships m WHERE m.church_slug = c.slug AND m.status = 'active')`, params: [payload] },
    assertion,
    { sql: `UPDATE church_enrichments AS e SET
        official_church_name = p.value->>'$.patch.name', street_address = p.value->>'$.patch.address',
        website_url = p.value->>'$.patch.website', service_times = p.value->'$.patch.serviceTimes',
        languages = p.value->'$.patch.languages', denomination_network = p.value->>'$.patch.denomination',
        phone = p.value->>'$.patch.phone', children_ministry = p.value->>'$.patch.childrenMinistry',
        youth_ministry = p.value->>'$.patch.youthMinistry', summary = p.value->>'$.patch.summary',
        seo_description = substr(p.value->>'$.patch.summary', 1, 160),
        what_to_expect = p.value->>'$.patch.review.facts.firstVisit.value',
        parking_info = p.value->>'$.patch.review.facts.transport.value',
        service_duration_minutes = p.value->>'$.patch.serviceDurationMinutes',
        ministries = '[]', good_fit_tags = '[]', visitor_faq = '[]',
        theological_orientation = NULL, church_size = NULL,
        pastor_name = NULL, pastor_title = NULL, pastor_photo_url = NULL,
        sources = json_set(CASE WHEN json_type(e.sources) = 'object' THEN e.sources
          ELSE json_object('legacy', json(e.sources)) END, '$.official_review', json(p.value->'$.patch.review')),
        last_enriched_at = p.value->>'$.checkedAt', updated_at = unixepoch() * 1000
      FROM json_each(?1) p WHERE e.church_slug = p.value->>'$.patch.slug'
        AND e.updated_at = p.value->>'$.enrichmentVersion'`, params: [payload] },
    assertion,
    { sql: `DROP TABLE ${guard}`, params: [] },
  ];
}
