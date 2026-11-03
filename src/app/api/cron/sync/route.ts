import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { refreshChurchUpdatesBatch } from "@/lib/church-updates";
import { getChurchStatsAsync, revalidateChurchChange, revalidateCronSync, revalidatePublicChurchContent } from "@/lib/content";

function authorized(request: NextRequest): boolean {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) {
    return false;
  }

  const bearer = request.headers.get("authorization")?.replace("Bearer ", "");
  return bearer === configuredSecret;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ?church=<slug> refreshes one church after a direct database fix (a script,
  // not admin): its page and the listings, without re-rendering every page.
  const church = request.nextUrl.searchParams.get("church");
  if (church !== null) {
    if (!/^[a-z0-9][a-z0-9-]{0,200}$/.test(church)) {
      return NextResponse.json({ error: "Invalid church slug" }, { status: 400 });
    }
    revalidateChurchChange(church);
    return NextResponse.json({ ok: true, revalidationMode: "church", church, runAt: new Date().toISOString() });
  }

  // ?full=true forces nuclear invalidation (use after schema changes, bulk imports, etc.)
  const forceAll = request.nextUrl.searchParams.get("full") === "true";

  if (forceAll) {
    revalidatePublicChurchContent();
  } else {
    revalidateCronSync();
  }

  revalidateTag("video-catalog", "max");
  revalidateTag("discover", "max");
  const { churchCount } = await getChurchStatsAsync();
  const updates = await refreshChurchUpdatesBatch();

  return NextResponse.json({
    ok: true,
    churchesRevalidated: churchCount,
    revalidationMode: forceAll ? "full" : "cron",
    updates,
    runAt: new Date().toISOString(),
  });
}
