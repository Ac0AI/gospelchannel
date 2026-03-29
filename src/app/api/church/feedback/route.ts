import { NextRequest, NextResponse } from "next/server";
import { addChurchFeedback } from "@/lib/church-community";
import { getChurchBySlugAsync } from "@/lib/content";

type FeedbackPayload = {
  churchSlug?: string;
  kind?: string;
  playlistUrl?: string;
  field?: string;
  message?: string;
};

function sanitize(value: string | undefined, maxLen: number): string {
  return (value ?? "").trim().slice(0, maxLen);
}

function sanitizeSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 64);
}

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

const FIELD_WHITELIST = new Set([
  "name",
  "description",
  "country",
  "website",
  "email",
  "playlist",
  "thumbnail",
  "metadata",
  "other",
]);

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as FeedbackPayload | null;
  if (!payload) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const churchSlug = sanitizeSlug(sanitize(payload.churchSlug, 64));
  const kind = sanitize(payload.kind, 40);
  const playlistUrl = sanitize(payload.playlistUrl, 500);
  const field = sanitize(payload.field, 64);
  const message = sanitize(payload.message, 500);

  if (!churchSlug) {
    return NextResponse.json({ error: "Church slug is required" }, { status: 400 });
  }

  if (!(await getChurchBySlugAsync(churchSlug))) {
    return NextResponse.json({ error: "Unknown church" }, { status: 404 });
  }

  if (kind !== "data_issue" && kind !== "playlist_addition" && kind !== "profile_addition") {
    return NextResponse.json({ error: "Invalid feedback type" }, { status: 400 });
  }

  if (kind === "playlist_addition" && (!playlistUrl || !isValidUrl(playlistUrl))) {
    return NextResponse.json({ error: "A valid playlist URL is required" }, { status: 400 });
  }

  if (!message || message.length < 3) {
    return NextResponse.json({ error: "Please include a short message (min 3 chars)" }, { status: 400 });
  }

  const normalizedField = field && FIELD_WHITELIST.has(field) ? field : "other";
  const feedback = await addChurchFeedback({
    churchSlug,
    kind,
    playlistUrl: kind === "playlist_addition" ? playlistUrl : undefined,
    field: kind === "profile_addition" ? sanitize(field, 200) : (kind === "data_issue" ? normalizedField : "playlist"),
    message,
  });

  return NextResponse.json({
    success: true,
    id: feedback.id,
    message: "Thanks! Your feedback has been queued for review.",
  });
}
