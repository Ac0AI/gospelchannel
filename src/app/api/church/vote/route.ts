import { NextRequest, NextResponse } from "next/server";
import { getChurchVoteCounts, incrementChurchVote } from "@/lib/church-community";
import { getPostHogClient } from "@/lib/posthog-server";
import { hasKvRateLimit, setKvRateLimit } from "@/lib/request-guards";

function sanitizeSlug(value: string): string {
  return value.replace(/[^a-z0-9-]/g, "").slice(0, 64);
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as { slug?: string } | null;
  const rawSlug = payload?.slug;

  if (!rawSlug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const slug = sanitizeSlug(rawSlug);
  if (!slug) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  const cookieName = `church_${slug}`;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ipKey = ip ? `church:vote:ip:${slug}:${ip}` : null;

  if (request.cookies.get(cookieName)?.value === "1") {
    const current = await getChurchVoteCounts([slug]);
    return NextResponse.json(
      { error: "Already voted", votes: current[slug] ?? 0 },
      { status: 429 }
    );
  }

  if (ipKey && await hasKvRateLimit(ipKey)) {
    const current = await getChurchVoteCounts([slug]);
    return NextResponse.json(
      { error: "Already voted", votes: current[slug] ?? 0 },
      { status: 429 }
    );
  }

  const votes = await incrementChurchVote(slug);
  if (ipKey) {
    await setKvRateLimit(ipKey, 60 * 60 * 24 * 7);
  }

  getPostHogClient().capture({
    distinctId: ip ?? "anonymous",
    event: "church_voted",
    properties: { church_slug: slug, total_votes: votes },
  });

  const response = NextResponse.json({ slug, votes });
  response.cookies.set(cookieName, "1", {
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
    httpOnly: false,
    sameSite: "lax",
  });

  return response;
}

export async function GET(request: NextRequest) {
  const slugsParam = request.nextUrl.searchParams.get("slugs") ?? "";
  const slugs = slugsParam
    .split(",")
    .map((s) => sanitizeSlug(s.trim()))
    .filter(Boolean)
    .slice(0, 50);

  const counts = await getChurchVoteCounts(slugs);
  return NextResponse.json(counts);
}
