import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";
import doShardedTagCache from "@opennextjs/cloudflare/overrides/tag-cache/do-sharded-tag-cache";

// R2 holds the rendered pages. The queue rebuilds a page in the background once
// its revalidate time has passed (without it, stale pages were served until the
// next deploy). The tag cache records revalidateTag/revalidatePath calls;
// without it those calls were silent no-ops. Durable Objects rather than D1:
// OpenNext recommends them for sites with real traffic (~65k church pages plus
// crawlers), and they need no extra token scope or table at deploy.
const cloudflareConfig = defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  queue: doQueue,
  tagCache: doShardedTagCache({
    // Every page view checks its tags; fewer shards means fewer parallel DO
    // calls per view. Load here is far below what four shards can take.
    baseShardSize: 4,
    // Tag lookups are cached per data center for 5 s, so a revalidation
    // reaches every region within seconds while busy tags skip the DO.
    regionalCache: true,
    regionalCacheTtlSec: 5,
    shardReplication: {
      numberOfSoftReplicas: 1,
      numberOfHardReplicas: 1,
      // One copy per continent: a page view asks the nearest one, while a
      // revalidation (rare) writes to all of them.
      regionalReplication: { defaultRegion: "enam" },
    },
  }),
});

const config = {
  ...cloudflareConfig,
  buildCommand: "next build --webpack",
};

export default config;
