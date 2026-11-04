import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { refreshChurchUpdatesBatch } from "@/lib/church-updates";
import { optimizeDatabase } from "@/db";
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

  // Index statistics first, so the queries below already get good plans.
  let databaseOptimized = false;
  try {
    await optimizeDatabase();
    databaseOptimized = true;
  } catch (error) {
    console.error("[cron-sync] PRAGMA optimize failed:", error instanceof Error ? error.message : error);
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
  // ?full=true is the cache flush the deploy runs right after going live, while
  // every data cache is still empty: it must stay a flush. Refreshing church
  // updates fetches sources and writes rows, which is the daily cron's job.
  const updates = forceAll ? null : await refreshChurchUpdatesBatch();

  return NextResponse.json({
    ok: true,
    churchesRevalidated: churchCount,
    revalidationMode: forceAll ? "full" : "cron",
    databaseOptimized,
    updates,
    runAt: new Date().toISOString(),
  });
}
