import { textChunks, LARGE_PAYLOAD_BYTES } from "../d1-snapshot-codec.mjs";

export async function readCrawlPayload(sql, enrichmentId, inlineValue) {
  if (inlineValue != null || !enrichmentId) return inlineValue;
  const chunks = await sql`SELECT part, value FROM church_enrichment_payload_chunks
    WHERE enrichment_id = ${enrichmentId} AND field = 'raw_crawled_pages' ORDER BY part`;
  if (!chunks.length) return null;
  if (chunks.some((chunk, index) => chunk.part !== index)) throw new Error("Incomplete crawl payload");
  return JSON.parse(chunks.map((chunk) => chunk.value).join(""));
}

/** Keep the row and its overflow chunks in the same D1 transaction. */
export function prepareCrawlPayload(value, keyColumn, keyValue) {
  if (!["church_slug", "candidate_id"].includes(keyColumn)) throw new Error("Invalid enrichment key");
  const encoded = value == null ? null : typeof value === "string" ? value : JSON.stringify(value);
  const overflow = encoded != null && Buffer.byteLength(encoded) > LARGE_PAYLOAD_BYTES;
  const predicate = `SELECT id FROM church_enrichments WHERE ${keyColumn} = ?1`;
  return {
    inline: overflow ? null : value,
    statements: [
      { sql: `DELETE FROM church_enrichment_payload_chunks WHERE enrichment_id = (${predicate}) AND field = 'raw_crawled_pages'`, params: [keyValue] },
      ...(overflow ? textChunks(encoded, 500_000).map((chunk, part) => ({
        sql: `INSERT INTO church_enrichment_payload_chunks (enrichment_id, field, part, value)
          SELECT id, 'raw_crawled_pages', ?2, ?3 FROM church_enrichments WHERE ${keyColumn} = ?1`,
        params: [keyValue, part, chunk],
      })) : []),
    ],
  };
}
