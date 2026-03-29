const DEFAULT_SITE_URL = "https://gospelchannel.com";

function normalizeSiteUrl(value: string | undefined | null): string | null {
  const candidate = value?.trim();
  if (!candidate) {
    return null;
  }

  try {
    return new URL(candidate).origin;
  } catch {
    return null;
  }
}

export function getConfiguredSiteUrl(): string {
  return (
    normalizeSiteUrl(process.env.PUBLIC_SITE_URL) ??
    normalizeSiteUrl(process.env.SITE_URL) ??
    DEFAULT_SITE_URL
  );
}

export function getSiteUrlFromHeaders(headers: Headers): string {
  const forwardedProto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || headers.get("host")?.trim();

  if (!host) {
    return getConfiguredSiteUrl();
  }

  const proto = forwardedProto || (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
