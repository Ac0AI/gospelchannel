import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { refreshChurchUpdatesBatch } from "@/lib/church-updates";
import { getChurchStatsAsync, revalidatePublicChurchContent } from "@/lib/content";

function authorized(request: NextRequest): boolean {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) {
    return true;
  }

  const bearer = request.headers.get("authorization")?.replace("Bearer ", "");
  const query = request.nextUrl.searchParams.get("secret");
  return bearer === configuredSecret || query === configuredSecret;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  revalidatePublicChurchContent();
  revalidateTag("video-catalog", "max");
  revalidateTag("discover", "max");
  const { churchCount } = await getChurchStatsAsync();
  const updates = await refreshChurchUpdatesBatch();

  return NextResponse.json({
    ok: true,
    churchesRevalidated: churchCount,
    updates,
    runAt: new Date().toISOString(),
  });
}
