import { NextRequest, NextResponse } from "next/server";
import { getTopChurchSlugs } from "@/lib/church-community";
import { getChurchesAsync } from "@/lib/content";

export async function GET(request: NextRequest) {
  const periodParam = request.nextUrl.searchParams.get("period") ?? "30d";
  const limitParam = request.nextUrl.searchParams.get("limit") ?? "10";

  const periodDays = Math.min(90, Math.max(1, parseInt(periodParam, 10) || 30));
  const limit = Math.min(20, Math.max(1, parseInt(limitParam, 10) || 10));

  const top = await getTopChurchSlugs(periodDays, limit);
  const churches = await getChurchesAsync();
  const bySlug = new Map(churches.map((c) => [c.slug, c]));

  const results = top
    .map(({ slug, votes }) => {
      const church = bySlug.get(slug);
      if (!church) return null;
      return {
        slug: church.slug,
        name: church.name,
        logo: church.logo,
        country: church.country,
        votes,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return NextResponse.json({ churches: results });
}
