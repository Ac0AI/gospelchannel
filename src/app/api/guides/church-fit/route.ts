import { NextRequest, NextResponse } from "next/server";
import { getChurchIndexPageData } from "@/lib/church";
import {
  buildDiscoveryLanes,
  getLaneDirectoryFilters,
  toToolChurchPreview,
  type ToolChurchPreview,
} from "@/lib/tooling";

const MAX_AREA_LENGTH = 80;
const MAX_LANES = 3;

export async function GET(request: NextRequest) {
  const laneIds = (request.nextUrl.searchParams.get("lanes") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, MAX_LANES);

  if (laneIds.length === 0) {
    return NextResponse.json({ error: "lanes are required" }, { status: 400 });
  }

  const area = request.nextUrl.searchParams.get("area")?.trim().slice(0, MAX_AREA_LENGTH) ?? "";
  const lanesById = new Map(buildDiscoveryLanes([]).map((lane) => [lane.id, lane]));
  const lanes = laneIds
    .map((laneId) => lanesById.get(laneId))
    .filter((lane): lane is NonNullable<typeof lane> => Boolean(lane));

  if (lanes.length === 0) {
    return NextResponse.json({ churches: [] });
  }

  const seen = new Set<string>();
  const matches: ToolChurchPreview[] = [];

  for (const lane of lanes) {
    const page = await getChurchIndexPageData({
      query: area,
      filters: getLaneDirectoryFilters(lane),
      page: 1,
      pageSize: 6,
    });

    for (const church of page.pageItems) {
      if (seen.has(church.slug)) continue;
      seen.add(church.slug);
      matches.push(toToolChurchPreview(church));
      if (matches.length >= 6) {
        return NextResponse.json({ churches: matches });
      }
    }
  }

  return NextResponse.json({ churches: matches });
}
