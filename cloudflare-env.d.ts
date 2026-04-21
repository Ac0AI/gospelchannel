declare interface CloudflareEnv {
  ASSETS: Fetcher;
  CHURCH_ASSETS: R2Bucket;
  NEXT_INC_CACHE_R2_BUCKET: R2Bucket;
  NEXT_INC_CACHE_R2_PREFIX?: string;
  CRON_SECRET?: string;
  NEXT_PUBLIC_MEDIA_BASE_URL?: string;
  NEXT_PUBLIC_SITE_URL?: string;
}
