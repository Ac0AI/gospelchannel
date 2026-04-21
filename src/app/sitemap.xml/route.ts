import { getSitemapIndexXml } from "@/lib/sitemap-data";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export async function GET() {
  const xml = await getSitemapIndexXml();
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
