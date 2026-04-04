declare interface CloudflareEnv {
  ASSETS: Fetcher;
  CHURCH_ASSETS: R2Bucket;
  CRON_SECRET?: string;
  NEXT_PUBLIC_SITE_URL?: string;
}
