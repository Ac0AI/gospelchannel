import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { addChurchClaim } from "@/lib/church-community";
import { getChurchBySlugAsync } from "@/lib/content";
import { sendClaimReceivedEmail, sendClaimAdminNotification } from "@/lib/email";
import { getClientIp, hasKvRateLimit, isBotTrapFilled, setKvRateLimit } from "@/lib/request-guards";
import { getPostHogClient } from "@/lib/posthog-server";

function sanitize(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as {
    churchSlug?: string;
    name?: string;
    role?: string;
    email?: string;
    message?: string;
    companyWebsite?: string;
  } | null;

  if (!payload) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (isBotTrapFilled(payload.companyWebsite)) {
    return NextResponse.json({
      success: true,
      message: "Your claim has been submitted for review.",
    });
  }

  const churchSlug = sanitize(payload.churchSlug ?? "", 64).toLowerCase().replace(/[^a-z0-9-]/g, "");
  const name = sanitize(payload.name ?? "", 120);
  const role = sanitize(payload.role ?? "", 100);
  const email = sanitize(payload.email ?? "", 200);
  const message = sanitize(payload.message ?? "", 500);
  const ip = getClientIp(request);
  const rateLimitKey = ip ? `church:claim:${churchSlug}:${ip}` : null;

  const church = await getChurchBySlugAsync(churchSlug);
  if (!churchSlug || !church) {
    return NextResponse.json({ error: "Unknown church" }, { status: 404 });
  }

  if (!name || name.length < 2) {
    return NextResponse.json({ error: "Name is required (min 2 characters)" }, { status: 400 });
  }

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  if (rateLimitKey && await hasKvRateLimit(rateLimitKey)) {
    return NextResponse.json({ error: "Please wait a bit before sending another claim" }, { status: 429 });
  }

  try {
    const claim = await addChurchClaim({
      churchSlug,
      name,
      role: role || undefined,
      email,
      message: message || undefined,
    });

    if (rateLimitKey) {
      await setKvRateLimit(rateLimitKey, 60 * 15);
    }

    getPostHogClient().capture({
      distinctId: email,
      event: "church_claim_received",
      properties: { church_slug: churchSlug, role: role || undefined, claim_id: claim.id },
    });

    const churchName = church.name || churchSlug;

    const { ctx } = await getCloudflareContext({ async: true });
    ctx.waitUntil(
      Promise.all([
        sendClaimReceivedEmail({ to: email, name, churchName, churchSlug })
          .catch((err) => console.error("[claim] Failed to send confirmation email:", err)),
        sendClaimAdminNotification({
          claimantName: name, claimantEmail: email, role: role || undefined,
          churchName, churchSlug, message: message || undefined,
        }).catch((err) => console.error("[claim] Failed to send admin notification:", err)),
      ]),
    );

    return NextResponse.json({
      success: true,
      id: claim.id,
      message: "Your claim has been submitted for review.",
    });
  } catch (err) {
    console.error("[claim] Failed to add claim:", err);
    return NextResponse.json(
      { error: "Failed to submit claim. Please try again." },
      { status: 500 },
    );
  }
}
