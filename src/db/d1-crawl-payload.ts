type Chunk = { part: number; value: string };

/** Reassemble an oversized crawl payload stored in D1-sized pieces. */
export function decodeCrawlPayload(chunks: Chunk[]): unknown {
  if (chunks.length === 0) return null;
  const ordered = [...chunks].sort((a, b) => a.part - b.part);
  for (let index = 0; index < ordered.length; index++) {
    if (ordered[index].part !== index || typeof ordered[index].value !== "string") {
      throw new Error("Incomplete crawl payload");
    }
  }
  return JSON.parse(ordered.map((chunk) => chunk.value).join(""));
}
