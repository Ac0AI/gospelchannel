import { NextRequest, NextResponse } from "next/server";
import { ensureChurchAccessForEmail } from "@/lib/church-community";

function sanitizeEmail(value: string | undefined): string {
  return (value || "").trim().toLowerCase().slice(0, 200);
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as {
    email?: string;
  } | null;

  const email = sanitizeEmail(payload?.email);
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  try {
    const memberships = await ensureChurchAccessForEmail(email);
    if (memberships.length === 0) {
      return NextResponse.json({ error: "No verified church access was found for this email" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
