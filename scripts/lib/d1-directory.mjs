export async function readRelatedCandidates(client, minScore) {
  const rows = [];
  let cursor = "";
  for (;;) {
    const page = await client.query(`SELECT c.slug, c.country, c.city_slug, c.directory_rank, c.display_score,
      c.music_style, c.denomination, ce.latitude, ce.longitude
    FROM churches c LEFT JOIN church_enrichments ce ON ce.id = (
      SELECT id FROM church_enrichments WHERE church_slug = c.slug ORDER BY updated_at DESC, id DESC LIMIT 1
    )
    WHERE c.status = 'approved' AND (c.display_score IS NULL OR c.display_score >= ?) AND c.slug > ?
    ORDER BY c.slug LIMIT 1000`, [minScore, cursor]);
    rows.push(...page);
    if (page.length < 1000) break;
    cursor = page.at(-1).slug;
  }
  return rows.map((row) => ({ ...row, music_style: row.music_style == null ? null : JSON.parse(row.music_style) }));
}

export async function writeRelatedRows(client, updates) {
  // Keep each JSON parameter comfortably below D1's per-value limit.
  for (let offset = 0; offset < updates.length; offset += 500) {
    const slice = updates.slice(offset, offset + 500);
    await client.query(`UPDATE churches AS c SET related_church_slugs = d.related
      FROM (SELECT json_extract(value, '$.slug') AS slug, json_extract(value, '$.related') AS related FROM json_each(?)) AS d
      WHERE c.slug = d.slug`, [JSON.stringify(slice)]);
  }
}
