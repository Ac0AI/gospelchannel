import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { sendChurchContactInquiry } from "@/lib/email";
import { getClientIp, hasKvRateLimit, setKvRateLimit } from "@/lib/request-guards";
import { getCloudflareContext } from "@opennextjs/cloudflare";

function sanitize(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug: rawSlug } = await context.params;
  const slug = sanitize(rawSlug ?? "", 200);
  if (!slug) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const payload = (await request.json().catch(() => null)) as {
    name?: string;
    email?: string;
    message?: string;
  } | null;

  if (!payload) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const name = sanitize(payload.name ?? "", 120);
  const email = sanitize(payload.email ?? "", 200);
  const message = sanitize(payload.message ?? "", 2000);

  if (!name || name.length < 2) {
    return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  }

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  if (!message || message.length < 5) {
    return NextResponse.json({ error: "Please write a short message (at least 5 characters)." }, { status: 400 });
  }

  const ip = getClientIp(request);
  const rateLimitKey = ip ? `church:contact:${ip}` : null;
  if (rateLimitKey && await hasKvRateLimit(rateLimitKey)) {
    return NextResponse.json(
      { error: "You have sent a contact recently. Please wait a few minutes before sending another." },
      { status: 429 },
    );
  }

  const databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
  if (!databaseUrl) {
    console.error("[church-contact] Missing DATABASE_URL");
    return NextResponse.json({ error: "Service unavailable. Please try again later." }, { status: 503 });
  }

  const sql = neon(databaseUrl);
  const rows = await sql`
    SELECT slug, name, email
    FROM churches
    WHERE slug = ${slug} AND status = 'approved'
    LIMIT 1
  ` as Array<{ slug: string; name: string; email: string | null }>;

  const church = rows[0];
  if (!church) {
    return NextResponse.json({ error: "Church not found." }, { status: 404 });
  }

  if (!church.email || !isValidEmail(church.email)) {
    return NextResponse.json(
      { error: "This church has not provided a contact email yet." },
      { status: 400 },
    );
  }

  if (rateLimitKey) {
    await setKvRateLimit(rateLimitKey, 60 * 5);
  }

  try {
    const { ctx } = await getCloudflareContext({ async: true });
    ctx.waitUntil(
      sendChurchContactInquiry({
        churchEmail: church.email,
        churchName: church.name,
        churchSlug: church.slug,
        senderName: name,
        senderEmail: email,
        message,
      }).catch((err) => {
        console.error("[church-contact] forward failed:", err);
      }),
    );
  } catch (err) {
    // If we are not running in a CF context (local dev), send synchronously
    console.warn("[church-contact] no waitUntil available, sending sync:", err);
    try {
      await sendChurchContactInquiry({
        churchEmail: church.email,
        churchName: church.name,
        churchSlug: church.slug,
        senderName: name,
        senderEmail: email,
        message,
      });
    } catch (sendErr) {
      console.error("[church-contact] sync forward failed:", sendErr);
      return NextResponse.json({ error: "Could not deliver your message. Please try again later." }, { status: 502 });
    }
  }

  return NextResponse.json({ success: true });
}
