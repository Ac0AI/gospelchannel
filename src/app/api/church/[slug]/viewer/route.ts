import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/server";
import { isAdminUser } from "@/lib/admin-users";
import {
  getChurchMembershipForUserAndSlug,
  getChurchMembershipsForUser,
} from "@/lib/church-community";

export const dynamic = "force-dynamic";

type ViewerMode = "anonymous" | "owner" | "church" | "admin";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const user = await getServerUser(request.headers);

  if (!user) {
    const mode: ViewerMode = "anonymous";
    return NextResponse.json({ mode });
  }

  const [activeMemberships, ownsCurrentChurch, viewerIsAdmin] = await Promise.all([
    getChurchMembershipsForUser(user.id),
    getChurchMembershipForUserAndSlug(user.id, slug),
    isAdminUser(user.id),
  ]);

  const mode: ViewerMode = ownsCurrentChurch
    ? "owner"
    : activeMemberships.length > 0
      ? "church"
      : viewerIsAdmin
        ? "admin"
        : "anonymous";

  return NextResponse.json({ mode });
}
