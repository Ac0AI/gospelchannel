import { getSitemapChunkXml } from "@/lib/sitemap-data";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await context.params;
  // Strip `.xml` suffix if present so both /sitemap-chunk/0 and /sitemap-chunk/0.xml work.
  const numeric = rawId.replace(/\.xml$/i, "");
  const id = Number.parseInt(numeric, 10);
  if (!Number.isInteger(id) || id < 0) {
    return new Response("Invalid sitemap id", { status: 400 });
  }

  const xml = await getSitemapChunkXml(id);
  if (!xml) {
    return new Response("Sitemap not found", { status: 404 });
  }
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // See sitemap.xml/route.ts: bound the worker edge cache to 5 min so
      // there is no >1 h staleness window when admin actions revalidate.
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
