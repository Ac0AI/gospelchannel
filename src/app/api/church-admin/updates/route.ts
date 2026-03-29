import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/server";
import { addChurchFeedback, getChurchMembershipForUserAndSlug } from "@/lib/church-community";
import { getChurchBySlugAsync } from "@/lib/content";

function sanitize(value: string | undefined, maxLen: number): string {
  return (value || "").trim().slice(0, maxLen);
}

function sanitizeSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 64);
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const user = await getServerUser(request.headers);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as {
    churchSlug?: string;
    website?: string;
    contactEmail?: string;
    playlistUrl?: string;
    message?: string;
  } | null;

  const churchSlug = sanitizeSlug(sanitize(payload?.churchSlug, 64));
  const website = sanitize(payload?.website, 500);
  const contactEmail = sanitize(payload?.contactEmail, 200).toLowerCase();
  const playlistUrl = sanitize(payload?.playlistUrl, 500);
  const message = sanitize(payload?.message, 500);

  if (!churchSlug || !(await getChurchBySlugAsync(churchSlug))) {
    return NextResponse.json({ error: "Unknown church" }, { status: 404 });
  }

  if (!website && !contactEmail && !playlistUrl && !message) {
    return NextResponse.json({ error: "Add at least one change before submitting" }, { status: 400 });
  }

  if (website && !isValidUrl(website)) {
    return NextResponse.json({ error: "Website must be a valid http or https URL" }, { status: 400 });
  }

  if (contactEmail && !isValidEmail(contactEmail)) {
    return NextResponse.json({ error: "Contact email is invalid" }, { status: 400 });
  }

  if (playlistUrl && !isValidUrl(playlistUrl)) {
    return NextResponse.json({ error: "Playlist URL must be a valid http or https URL" }, { status: 400 });
  }

  try {
    const membership = await getChurchMembershipForUserAndSlug(user.id, churchSlug);
    if (!membership) {
      return NextResponse.json({ error: "No active access for this church" }, { status: 403 });
    }

    const sharedMeta = {
      churchSlug,
      source: "claimed_owner" as const,
      submittedByName: membership.fullName || undefined,
      submittedByEmail: membership.email,
    };

    const rows = [];

    if (website) {
      rows.push(
        addChurchFeedback({
          ...sharedMeta,
          kind: "data_issue",
          field: "website",
          message: message
            ? `Claimed owner submitted official website: ${website}\n\nNote: ${message}`
            : `Claimed owner submitted official website: ${website}`,
        })
      );
    }

    if (contactEmail) {
      rows.push(
        addChurchFeedback({
          ...sharedMeta,
          kind: "data_issue",
          field: "email",
          message: message
            ? `Claimed owner submitted contact email: ${contactEmail}\n\nNote: ${message}`
            : `Claimed owner submitted contact email: ${contactEmail}`,
        })
      );
    }

    if (playlistUrl) {
      rows.push(
        addChurchFeedback({
          ...sharedMeta,
          kind: "playlist_addition",
          playlistUrl,
          field: "playlist",
          message: message
            ? `Claimed owner submitted playlist addition.\n\nNote: ${message}`
            : "Claimed owner submitted playlist addition.",
        })
      );
    }

    if (!website && !contactEmail && !playlistUrl && message) {
      rows.push(
        addChurchFeedback({
          ...sharedMeta,
          kind: "data_issue",
          field: "other",
          message: `Claimed owner note: ${message}`,
        })
      );
    }

    await Promise.all(rows);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
