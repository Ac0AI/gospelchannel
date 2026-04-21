import { getSitemapIndexXml } from "@/lib/sitemap-data";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export async function GET() {
  const xml = await getSitemapIndexXml();
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Worker-level edge cache (worker.ts) honours s-maxage. Cap it at 5 min
      // so admin actions surface within minutes even though we have no
      // explicit edge-cache invalidation hook. Next's unstable_cache (1h with
      // CHURCH_INDEX_TAG) still covers the slow underlying assembly.
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
