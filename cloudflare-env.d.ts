declare interface CloudflareEnv {
  ASSETS: Fetcher;
  GOSPEL_D1: import("drizzle-orm/d1").AnyD1Database;
  CHURCH_ASSETS: R2Bucket;
  NEXT_INC_CACHE_R2_BUCKET: R2Bucket;
  NEXT_INC_CACHE_R2_PREFIX?: string;
  CRON_SECRET?: string;
  /** Fine-grained GitHub token (Actions read/write on Ac0AI/gospelchannel) for the nightly reconcile dispatch. */
  GITHUB_DISPATCH_TOKEN?: string;
  NEXT_PUBLIC_MEDIA_BASE_URL?: string;
  NEXT_PUBLIC_SITE_URL?: string;
}
