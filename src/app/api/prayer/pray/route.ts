import { NextRequest, NextResponse } from "next/server";
import { incrementPrayedCount } from "@/lib/prayer";
import { getPostHogClient } from "@/lib/posthog-server";
import { hasKvRateLimit, setKvRateLimit } from "@/lib/request-guards";

export async function POST(request: NextRequest) {
  try {
    const { prayerId } = await request.json();

    if (!prayerId || typeof prayerId !== "string") {
      return NextResponse.json({ error: "prayerId is required" }, { status: 400 });
    }

    // Rate limit: 1 pray per prayer per IP (24h)
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const rateLimitKey = `prayer:prayed:${prayerId}:${ip}`;
    if (await hasKvRateLimit(rateLimitKey)) {
      return NextResponse.json({ error: "Already prayed" }, { status: 429 });
    }
    await setKvRateLimit(rateLimitKey, 86400);

    const count = await incrementPrayedCount(prayerId);
    getPostHogClient().capture({
      distinctId: ip,
      event: "prayer_prayed",
      properties: { prayer_id: prayerId, total_prayed: count },
    });
    return NextResponse.json({ prayedCount: count });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
