import { NextRequest, NextResponse } from "next/server";
import { getChurchIndexData } from "@/lib/church";
import { buildDiscoveryLanes, collectLaneChurchMatches } from "@/lib/tooling";

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
  const churches = await getChurchIndexData();
  const lanesById = new Map(buildDiscoveryLanes(churches).map((lane) => [lane.id, lane]));
  const lanes = laneIds
    .map((laneId) => lanesById.get(laneId))
    .filter((lane): lane is NonNullable<typeof lane> => Boolean(lane));

  if (lanes.length === 0) {
    return NextResponse.json({ churches: [] });
  }

  const matches = collectLaneChurchMatches(churches, lanes, {
    query: area,
    limit: 6,
  });

  return NextResponse.json({ churches: matches });
}
