import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/server";
import { getChurchMembershipsForUser } from "@/lib/church-community";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getServerUser(request.headers);
  if (!user) return NextResponse.json(null, { status: 401 });

  try {
    const memberships = await getChurchMembershipsForUser(user.id);
    const primaryMembership = memberships[0] ?? null;

    return NextResponse.json(
      {
        churchSlug: primaryMembership?.churchSlug ?? null,
        churchCount: memberships.length,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load church access" },
      { status: 500 },
    );
  }
}
