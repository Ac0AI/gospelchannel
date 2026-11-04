export async function readRelatedCandidates(client, minScore) {
  const rows = [];
  let cursor = "";
  for (;;) {
    const page = await client.query(`SELECT c.slug, c.country, c.city_slug, c.directory_rank, c.display_score,
      c.music_style, c.denomination, c.related_church_slugs, ce.latitude, ce.longitude
    FROM churches c LEFT JOIN church_enrichments ce ON ce.id = (
      SELECT id FROM church_enrichments WHERE church_slug = c.slug ORDER BY updated_at DESC, id DESC LIMIT 1
    )
    WHERE c.status = 'approved' AND (c.display_score IS NULL OR c.display_score >= ?) AND c.slug > ?
    ORDER BY c.slug LIMIT 1000`, [minScore, cursor]);
    rows.push(...page);
    if (page.length < 1000) break;
    cursor = page.at(-1).slug;
  }
  return rows.map((row) => ({
    ...row,
    music_style: row.music_style == null ? null : JSON.parse(row.music_style),
    related_church_slugs: row.related_church_slugs == null ? null : JSON.parse(row.related_church_slugs),
  }));
}

// Only churches whose related list actually changed. Rewriting all ~83k rows
// every night overloaded D1 for the site's visitors (2026-11-04); most lists
// are the same as yesterday.
export function changedRelatedRows(currentBySlug, updates) {
  return updates.filter(({ slug, related }) => JSON.stringify(currentBySlug.get(slug) ?? null) !== JSON.stringify(related));
}

export async function writeRelatedRows(client, updates, { pauseMs = 2000 } = {}) {
  // Keep each JSON parameter comfortably below D1's per-value limit, and pause
  // between statements: the site serves visitors from the same database.
  for (let offset = 0; offset < updates.length; offset += 500) {
    if (offset > 0 && pauseMs > 0) await new Promise((resolve) => setTimeout(resolve, pauseMs));
    const slice = updates.slice(offset, offset + 500);
    await client.query(`UPDATE churches AS c SET related_church_slugs = d.related
      FROM (SELECT json_extract(value, '$.slug') AS slug, json_extract(value, '$.related') AS related FROM json_each(?)) AS d
      WHERE c.slug = d.slug`, [JSON.stringify(slice)]);
  }
}
