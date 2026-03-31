import { NextRequest, NextResponse } from "next/server";
import { addChurchSuggestion } from "@/lib/church-community";
import { getClientIp, hasKvRateLimit, isBotTrapFilled, setKvRateLimit } from "@/lib/request-guards";
import { getPostHogClient } from "@/lib/posthog-server";
import { enrichFromWebsite, saveEnrichmentToSuggestion } from "@/lib/auto-enrich";
import { getCloudflareContext } from "@opennextjs/cloudflare";

function sanitize(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as {
    name?: string;
    city?: string;
    country?: string;
    website?: string;
    contactEmail?: string;
    denomination?: string;
    language?: string;
    playlistUrl?: string;
    message?: string;
    companyWebsite?: string;
  } | null;

  if (!payload) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (isBotTrapFilled(payload.companyWebsite)) {
    return NextResponse.json({
      success: true,
      message: "Thank you! Your church suggestion has been received.",
    });
  }

  const name = sanitize(payload.name ?? "", 120);
  const city = sanitize(payload.city ?? "", 80);
  const country = sanitize(payload.country ?? "", 60);
  const website = sanitize(payload.website ?? "", 300);
  const contactEmail = sanitize(payload.contactEmail ?? "", 200);
  const denomination = sanitize(payload.denomination ?? "", 80);
  const language = sanitize(payload.language ?? "", 40);
  const playlistUrl = sanitize(payload.playlistUrl ?? "", 500);
  const message = sanitize(payload.message ?? "", 500);
  const ip = getClientIp(request);
  const rateLimitKey = ip ? `church:suggest:${ip}` : null;

  if (!name || name.length < 2) {
    return NextResponse.json({ error: "Church name is required (min 2 characters)" }, { status: 400 });
  }

  if (!website || !isValidUrl(website)) {
    return NextResponse.json({ error: "A valid church website URL is required" }, { status: 400 });
  }

  if (!contactEmail || !isValidEmail(contactEmail)) {
    return NextResponse.json({ error: "A valid contact email is required" }, { status: 400 });
  }

  if (!playlistUrl || !isValidUrl(playlistUrl)) {
    return NextResponse.json({ error: "A valid playlist URL is required (Spotify or YouTube)" }, { status: 400 });
  }

  if (rateLimitKey && await hasKvRateLimit(rateLimitKey)) {
    return NextResponse.json({ error: "Please wait a bit before sending another suggestion" }, { status: 429 });
  }

  const suggestion = await addChurchSuggestion({
    name,
    city,
    country,
    website,
    contactEmail,
    denomination,
    language,
    playlistUrl,
    message,
  });

  if (rateLimitKey) {
    await setKvRateLimit(rateLimitKey, 60 * 15);
  }

  getPostHogClient().capture({
    distinctId: contactEmail,
    event: "church_suggestion_received",
    properties: { church_name: name, country, language, suggestion_id: suggestion.id },
  });

  // Auto-enrich in the background (don't block the response)
  try {
    const { ctx } = await getCloudflareContext({ async: true });
    ctx.waitUntil(
      enrichFromWebsite({ name, website, country, city, denomination })
        .then((result) => {
          if (result) return saveEnrichmentToSuggestion(suggestion.id, result);
        })
        .catch((err) => console.error("[auto-enrich] Background error:", err))
    );
  } catch {
    // Enrichment is best-effort; don't fail the suggestion
  }

  return NextResponse.json({
    success: true,
    id: suggestion.id,
    message: "Thank you! Your church suggestion has been received.",
  });
}
