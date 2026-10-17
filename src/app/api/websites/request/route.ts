import { NextRequest, NextResponse } from "next/server";
import { sendWebsiteRequestAdminNotification } from "@/lib/email";
import { getClientIp, hasKvRateLimit, isBotTrapFilled, setKvRateLimit } from "@/lib/request-guards";

// "See your new site" on /websites: a church sends its current website and we
// build a preview from it. The request goes to the admins by email.

function clean(value: unknown, maxLen: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLen) : "";
}

function normalizeWebsite(value: string): string | null {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withProtocol);
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Bots fill every field; people never see this one.
  if (isBotTrapFilled(clean(payload.companyWebsite, 200))) {
    return NextResponse.json({ ok: true });
  }

  const website = normalizeWebsite(clean(payload.website, 300));
  const email = clean(payload.email, 200);
  const name = clean(payload.name, 120);
  const church = clean(payload.church, 160);

  if (!website) {
    return NextResponse.json({ error: "Please enter your church's current website address." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address so we can send you the preview." }, { status: 400 });
  }

  const ip = getClientIp(request);
  const rateLimitKey = ip ? `websites:request:${ip}` : null;
  if (rateLimitKey && await hasKvRateLimit(rateLimitKey)) {
    return NextResponse.json({ error: "We already have your request. We'll be in touch soon." }, { status: 429 });
  }

  console.log("[websites-request]", website, church || "(no church name)");
  try {
    await sendWebsiteRequestAdminNotification({ website, email, name, church });
  } catch (error) {
    console.error("[websites-request] notification failed", error);
    return NextResponse.json({ error: "Something went wrong. Please email hi@gospelchannel.com instead." }, { status: 502 });
  }

  if (rateLimitKey) {
    await setKvRateLimit(rateLimitKey, 60 * 10);
  }
  return NextResponse.json({ ok: true });
}
