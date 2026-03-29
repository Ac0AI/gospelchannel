import { NextRequest, NextResponse } from "next/server";
import { hasSupabaseServiceConfig, createAdminClient } from "@/lib/supabase";
import { getClientIp, hasKvRateLimit, isBotTrapFilled, setKvRateLimit } from "@/lib/request-guards";
import { getPostHogClient } from "@/lib/posthog-server";

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as {
    churchSlug?: string;
    email?: string;
    name?: string;
    companyWebsite?: string;
  } | null;

  if (!payload?.churchSlug || !payload?.email) {
    return NextResponse.json({ error: "Missing churchSlug or email" }, { status: 400 });
  }

  if (isBotTrapFilled(payload.companyWebsite)) {
    return NextResponse.json({ ok: true });
  }

  const slug = payload.churchSlug.replace(/[^a-z0-9-]/g, "").slice(0, 64);
  const email = payload.email.trim().toLowerCase().slice(0, 255);
  const name = payload.name?.trim().slice(0, 100) || null;
  const ip = getClientIp(request);
  const rateLimitKey = ip ? `church:follow:${slug}:${ip}` : null;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  if (rateLimitKey && await hasKvRateLimit(rateLimitKey)) {
    return NextResponse.json({ error: "Please wait a bit before trying again" }, { status: 429 });
  }

  const sb = createAdminClient();
  const { error } = await sb
    .from("church_followers")
    .upsert(
      { church_slug: slug, email, name, created_at: new Date().toISOString() },
      { onConflict: "church_slug,email" }
    );

  if (error) {
    return NextResponse.json({ error: "Failed to follow" }, { status: 500 });
  }

  if (rateLimitKey) {
    await setKvRateLimit(rateLimitKey, 60 * 10);
  }

  getPostHogClient().capture({
    distinctId: email,
    event: "church_follow_received",
    properties: { church_slug: slug },
  });

  return NextResponse.json({ ok: true });
}
