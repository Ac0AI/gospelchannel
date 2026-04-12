import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/neon-client";

export async function GET(request: NextRequest) {
  const user = await getServerUser(request.headers);
  if (!user) return NextResponse.json(null, { status: 401 });

  const sb = createAdminClient();
  const { data } = await sb
    .from<{ church_slug: string }>("church_memberships")
    .select("church_slug")
    .eq("user_id", user.id)
    .eq("role", "owner")
    .maybeSingle();

  if (!data) return NextResponse.json({ churchSlug: null });
  return NextResponse.json({ churchSlug: data.church_slug });
}
