import { NextResponse, type NextRequest } from "next/server";
import { findChurchesNear } from "@/lib/mcp/church-queries";
import { parseNearbyChurchSearchInput } from "@/lib/nearby-church-search";

const MAX_BODY_BYTES = 2_048;

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request is too large." }, { status: 413 });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "Request could not be read." }, { status: 400 });
  }

  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request is too large." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Request must be valid JSON." }, { status: 400 });
  }

  const parsed = parseNearbyChurchSearchInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const input = parsed.value;
    const churches = await findChurchesNear({
      latitude: input.latitude,
      longitude: input.longitude,
      radiusKm: input.radiusKm,
      limit: input.limit,
      worshipStyle: input.worshipStyle,
      denomination: input.denomination,
      language: input.language,
      hasServiceTimes: input.hasServiceTimes,
      kids: input.kids,
    });

    return NextResponse.json(
      { churches },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "X-Robots-Tag": "noindex",
        },
      },
    );
  } catch (error) {
    console.error("[nearby-churches] Search failed", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Church search is temporarily unavailable." }, { status: 503 });
  }
}
