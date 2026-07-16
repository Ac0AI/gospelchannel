import { NextRequest, NextResponse } from "next/server";
import { addChurchSuggestion } from "@/lib/church-community";
import { sendSuggestionAdminNotification } from "@/lib/email";
import { getClientIp, hasKvRateLimit, isBotTrapFilled, setKvRateLimit } from "@/lib/request-guards";
import { captureServerEvent } from "@/lib/posthog-server";
import { enrichFromWebsite, saveEnrichmentToSuggestion } from "@/lib/auto-enrich";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const CORS_ORIGINS = new Set(["https://playlist.church", "https://www.playlist.church"]);

function corsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get("origin") || "";
  return CORS_ORIGINS.has(origin)
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" }
    : { Vary: "Origin" };
}

function json(request: NextRequest, body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, { ...init, headers: corsHeaders(request) });
}

export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

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

function isValidPlaylistUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (!/^https?:$/.test(url.protocol)) return false;
    if (host === "open.spotify.com") return /^\/(?:intl-[a-z]{2}\/)?playlist\/[a-zA-Z0-9]{22}\/?$/.test(url.pathname);
    if (host === "music.apple.com") return /^\/[a-z]{2}\/playlist\//i.test(url.pathname);
    return (host === "youtube.com" || host === "m.youtube.com") && url.pathname === "/playlist" && !!url.searchParams.get("list");
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
    return json(request, { error: "Invalid request" }, { status: 400 });
  }

  if (isBotTrapFilled(payload.companyWebsite)) {
    return json(request, {
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
    return json(request, { error: "Church name is required (min 2 characters)" }, { status: 400 });
  }

  if (!website || !isValidUrl(website)) {
    return json(request, { error: "A valid church website URL is required" }, { status: 400 });
  }

  if (!contactEmail || !isValidEmail(contactEmail)) {
    return json(request, { error: "A valid contact email is required" }, { status: 400 });
  }

  if (!playlistUrl || !isValidPlaylistUrl(playlistUrl)) {
    return json(request, { error: "A valid playlist URL is required (Spotify, Apple Music, or YouTube)" }, { status: 400 });
  }

  if (rateLimitKey && await hasKvRateLimit(rateLimitKey)) {
    return json(request, { error: "Please wait a bit before sending another suggestion" }, { status: 429 });
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

  await captureServerEvent({
    distinctId: contactEmail,
    event: "church_suggestion_received",
    properties: { church_name: name, country, language, suggestion_id: suggestion.id },
  });

  // Auto-enrich + admin notification in the background (don't block the response)
  try {
    const { ctx } = await getCloudflareContext({ async: true });
    ctx.waitUntil(
      Promise.all([
        enrichFromWebsite({ name, website, country, city, denomination })
          .then((result) => {
            if (result) return saveEnrichmentToSuggestion(suggestion.id, result);
          })
          .catch((err) => console.error("[auto-enrich] Background error:", err)),
        sendSuggestionAdminNotification({
          churchName: name, contactEmail, country, website, playlistUrl, message,
        }).catch((err) => console.error("[suggest] Failed to send admin notification:", err)),
      ]),
    );
  } catch {
    // Background tasks are best-effort; don't fail the suggestion
  }

  return json(request, {
    success: true,
    id: suggestion.id,
    message: "Thank you! Your church suggestion has been received.",
  });
}
