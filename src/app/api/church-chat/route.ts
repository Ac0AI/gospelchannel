// POST /api/church-chat: answers a question typed into the church search box.
// Each answer is a paid model call, and ~99% of edge traffic is bots, so the
// route takes same-origin JSON only and caps calls per visitor and per day.

import { NextResponse, type NextRequest } from "next/server";
import { answerChurchQuestion, defaultChurchChatDeps } from "@/lib/church-chat/answer";
import { parseChurchChatRequest } from "@/lib/church-chat/request";
import { getClientIp, incrementRateLimitValue } from "@/lib/request-guards";

export const dynamic = "force-dynamic";

const PER_VISITOR_10_MIN = 8;
const PER_VISITOR_PER_DAY = 30;
const SITE_PER_DAY = 100;

const ALLOWED_ORIGINS = new Set([
  "https://gospelchannel.com",
  "https://www.gospelchannel.com",
]);

function isAllowedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  return process.env.NODE_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!isAllowedOrigin(request)) {
    return json({ error: "forbidden" }, 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_request" }, 400);
  }
  const chatRequest = parseChurchChatRequest(body);
  if (!chatRequest) {
    return json({ error: "invalid_request" }, 400);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json({ error: "unavailable" }, 503);
  }

  const ip = getClientIp(request) ?? "unknown";
  const day = new Date().toISOString().slice(0, 10);
  // incrementRateLimitValue never resets an expired row, so every key carries
  // its own time window: a fixed 10-minute bucket, or the date.
  const tenMinuteWindow = Math.floor(Date.now() / 600_000);
  const [visitorShort, visitorDay, siteDay] = await Promise.all([
    incrementRateLimitValue(`church-chat:ip10m:${ip}:${tenMinuteWindow}`, 600),
    incrementRateLimitValue(`church-chat:ipday:${ip}:${day}`, 86_400),
    incrementRateLimitValue(`church-chat:site:${day}`, 172_800),
  ]);
  if (visitorShort > PER_VISITOR_10_MIN || visitorDay > PER_VISITOR_PER_DAY) {
    return json({ error: "rate_limited" }, 429);
  }
  if (siteDay > SITE_PER_DAY) {
    return json({ error: "busy" }, 429);
  }

  try {
    const answer = await answerChurchQuestion(chatRequest, defaultChurchChatDeps(apiKey));
    return json(answer);
  } catch (error) {
    console.error("[church-chat] answer failed", error instanceof Error ? error.message : error);
    return json({ error: "failed" }, 502);
  }
}
