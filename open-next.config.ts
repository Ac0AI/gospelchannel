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
const shardedTagCache = doShardedTagCache({
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
});

// Emergency brake. The Durable Object migration cannot be rolled back past, so
// instead of `wrangler rollback` the worker secret GOSPEL_CACHE_OFF=1 puts the
// cache back to how it worked before the queue and tag cache: pages are served
// from R2 until the next deploy and revalidate calls do nothing. The bindings
// stay. Read when the server first handles a request, after process.env holds
// the worker's secrets; a secret change starts fresh isolates.
//   on:  printf 1 | wrangler secret put GOSPEL_CACHE_OFF
//   off: wrangler secret delete GOSPEL_CACHE_OFF
const cacheOff = () => process.env.GOSPEL_CACHE_OFF === "1";

const tagCacheOff = {
  name: "gospel-cache-off",
  mode: "original" as const,
  getByPath: async () => [],
  getByTag: async () => [],
  getLastModified: async (_key: string, lastModified?: number) => lastModified ?? Date.now(),
  writeTags: async () => {},
};

const queueOff = {
  name: "gospel-cache-off",
  send: async () => {},
};

const cloudflareConfig = defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  queue: () => (cacheOff() ? queueOff : doQueue),
  tagCache: () => (cacheOff() ? tagCacheOff : shardedTagCache),
});

const config = {
  ...cloudflareConfig,
  buildCommand: "next build --webpack",
};

export default config;
