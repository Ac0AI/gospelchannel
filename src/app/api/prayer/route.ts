import { NextRequest, NextResponse } from "next/server";
import { submitPrayer, getPrayers, getPrayersFiltered } from "@/lib/prayer";
import { getRateLimitValue, hasKvRateLimit, incrementRateLimitValue, setKvRateLimit } from "@/lib/request-guards";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const churchSlug = searchParams.get("church") || undefined;
  const country = searchParams.get("country") || undefined;
  const city = searchParams.get("city") || undefined;
  const limit = Math.min(Number(searchParams.get("limit") || 20), 50);
  const offset = Number(searchParams.get("offset") || 0);

  if (country || city) {
    const prayers = await getPrayersFiltered({ country, city, churchSlug, limit, offset });
    return NextResponse.json({ prayers });
  }

  const prayers = await getPrayers({ churchSlug, limit, offset });
  return NextResponse.json({ prayers });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { churchSlug, content, authorName } = body;

    if (!churchSlug || typeof churchSlug !== "string" || churchSlug.length > 200) {
      return NextResponse.json({ error: "churchSlug is required" }, { status: 400 });
    }
    if (!content || typeof content !== "string" || content.length < 3 || content.length > 500) {
      return NextResponse.json({ error: "content must be 3-500 characters" }, { status: 400 });
    }
    if (authorName !== undefined && (typeof authorName !== "string" || authorName.length > 50)) {
      return NextResponse.json({ error: "authorName must be under 50 characters" }, { status: 400 });
    }

    // Rate limit: 1 prayer per 2 minutes per IP, max 10 per hour
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateLimitKey = `prayer:rate:${ip}`;
    const hourlyKey = `prayer:hourly:${ip}`;
    if (await hasKvRateLimit(rateLimitKey)) {
      return NextResponse.json({ error: "Please wait before submitting another prayer" }, { status: 429 });
    }
    const hourlyCount = await getRateLimitValue(hourlyKey);
    if (hourlyCount >= 10) {
      return NextResponse.json({ error: "Too many prayers this hour. Please try again later." }, { status: 429 });
    }

    const prayer = await submitPrayer(
      churchSlug,
      content.trim(),
      typeof authorName === "string" ? authorName.trim() || undefined : undefined
    );

    if (!prayer) {
      return NextResponse.json({ error: "Failed to submit prayer" }, { status: 500 });
    }

    // Set rate limits after successful submission
    await setKvRateLimit(rateLimitKey, 120);
    await incrementRateLimitValue(hourlyKey, 3600);

    return NextResponse.json({ prayer }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
