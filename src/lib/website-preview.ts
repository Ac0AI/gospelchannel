export type WebsitePreview = {
  finalUrl: string;
  title: string;
  description: string;
  headerImageUrl: string;
  emails: string[];
  contactEmail: string;
};

const IGNORE_EMAIL_PATTERNS = [
  /sentry/i,
  /wixpress/i,
  /cloudflare/i,
  /facebook/i,
  /youtube/i,
  /example\.com/i,
  /user@domain\.com/i,
  /noreply/i,
  /no-reply/i,
  /donotreply/i,
  /\.(png|jpg|jpeg|gif|svg|webp|css|js)$/i,
];

const EXTRA_PAGE_PATHS = [
  "/contact",
  "/contact-us",
  "/about",
  "/about-us",
  "/connect",
  "/visit",
  "/new-here",
  "/staff",
  "/team",
  "/om",
  "/kontakt",
];

function normalizeWhitespace(value = ""): string {
  return value.replace(/\s+/g, " ").trim();
}

function decodeHtml(value = ""): string {
  return value
    .replace(/&#8211;|&#x2013;/gi, " - ")
    .replace(/&#8212;|&#x2014;/gi, " - ")
    .replace(/&#8217;|&#x2019;/gi, "'")
    .replace(/&#038;|&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ");
}

function absoluteUrl(value = "", baseUrl = ""): string {
  if (!value) return "";

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return "";
  }
}

function normalizeHost(url = ""): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function normalizeEmail(email = ""): string {
  return email.trim().toLowerCase().replace(/^u003e/, "");
}

function isOfficialEmailDomain(emailDomain = "", host = ""): boolean {
  if (!emailDomain || !host) return false;
  return (
    emailDomain === host
    || host.endsWith(`.${emailDomain}`)
    || emailDomain.endsWith(`.${host}`)
  );
}

function isValidOfficialEmail(email = "", host = ""): boolean {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  if (IGNORE_EMAIL_PATTERNS.some((pattern) => pattern.test(email))) return false;
  if (!host) return true;

  const emailDomain = email.split("@")[1]?.replace(/^www\./, "");
  return isOfficialEmailDomain(emailDomain || "", host);
}

function extractEmailsFromHtml(html = "", host = ""): string[] {
  const decoded = html
    .replace(/&#64;/g, "@")
    .replace(/\[at\]/gi, "@")
    .replace(/%40/g, "@");

  const matches = decoded.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [];
  return uniqueStrings(
    matches
      .map((email) => normalizeEmail(email))
      .filter((email) => isValidOfficialEmail(email, host))
  ).sort((left, right) => {
    const leftPreferred = /^(info|hello|contact|office|worship|music)@/.test(left) ? 1 : 0;
    const rightPreferred = /^(info|hello|contact|office|worship|music)@/.test(right) ? 1 : 0;
    return rightPreferred - leftPreferred;
  });
}

async function fetchPage(url: string, signal: AbortSignal): Promise<{ html: string; finalUrl: string }> {
  const response = await fetch(url, {
    signal,
    headers: { "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0)" },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Website returned ${response.status}`);
  }

  return {
    html: await response.text(),
    finalUrl: response.url || url,
  };
}

async function fetchOptionalPage(url: string, signal: AbortSignal): Promise<string> {
  try {
    const response = await fetch(url, {
      signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0)" },
      redirect: "follow",
    });

    if (!response.ok) return "";
    return await response.text();
  } catch {
    return "";
  }
}

function parseTitleFromHtml(html = ""): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? normalizeWhitespace(decodeHtml(match[1])) : "";
}

function parseMetaContent(html = "", attribute = "property", value = ""): string {
  if (!value) return "";

  const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const primaryPattern = new RegExp(
    `<meta[^>]+${attribute}=["']${escapedValue}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const fallbackPattern = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+${attribute}=["']${escapedValue}["'][^>]*>`,
    "i"
  );

  const match = html.match(primaryPattern) || html.match(fallbackPattern);
  return match ? decodeHtml(match[1]).trim() : "";
}

export async function fetchWebsitePreview(url: string, timeoutMs = 12000): Promise<WebsitePreview> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const homepage = await fetchPage(url, controller.signal);
    const finalUrl = homepage.finalUrl;
    const host = normalizeHost(finalUrl);
    const extraPages = await Promise.all(
      EXTRA_PAGE_PATHS.map((path) => fetchOptionalPage(absoluteUrl(path, finalUrl), controller.signal))
    );
    const pages = [homepage.html, ...extraPages];
    const title =
      parseMetaContent(homepage.html, "property", "og:title")
      || parseMetaContent(homepage.html, "name", "og:title")
      || parseTitleFromHtml(homepage.html);
    const description =
      parseMetaContent(homepage.html, "property", "og:description")
      || parseMetaContent(homepage.html, "name", "description");
    const headerImageUrl =
      parseMetaContent(homepage.html, "property", "og:image")
      || parseMetaContent(homepage.html, "name", "og:image")
      || parseMetaContent(homepage.html, "property", "twitter:image")
      || parseMetaContent(homepage.html, "name", "twitter:image");
    const emails = uniqueStrings(pages.flatMap((html) => extractEmailsFromHtml(html, host)));

    return {
      finalUrl,
      title,
      description,
      headerImageUrl: absoluteUrl(headerImageUrl, finalUrl),
      emails,
      contactEmail: emails[0] || "",
    };
  } finally {
    clearTimeout(timer);
  }
}
