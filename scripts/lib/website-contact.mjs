import { normalizeHost } from "./church-intake-utils.mjs";

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const IGNORE_PATTERNS = [
  /noreply/i,
  /no-reply/i,
  /donotreply/i,
  /sentry/i,
  /wixpress/i,
  /cloudflare/i,
  /google/i,
  /facebook/i,
  /instagram/i,
  /youtube/i,
  /example\.com/i,
  /localhost/i,
];

export function scoreContactEmail(email, churchDomain = "") {
  const lower = String(email || "").toLowerCase();
  let score = 0;
  if (churchDomain && lower.endsWith(`@${churchDomain}`)) score += 10;
  if (/^(contact|info|hello|office|worship|music|media|admin)@/.test(lower)) score += 5;
  if (/@gmail|@hotmail|@outlook|@yahoo/i.test(lower)) score -= 2;
  return score;
}

export function extractEmailsFromHtml(html = "", churchDomain = "") {
  const decoded = String(html)
    .replace(/&#64;/g, "@")
    .replace(/\[at\]/gi, "@")
    .replace(/%40/g, "@");

  const matches = decoded.match(EMAIL_REGEX) || [];
  return [...new Set(matches.map((email) => email.toLowerCase()))]
    .filter((email) => !IGNORE_PATTERNS.some((pattern) => pattern.test(email)))
    .sort((left, right) => scoreContactEmail(right, churchDomain) - scoreContactEmail(left, churchDomain));
}

async function fetchPage(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0)" },
    });
    if (!response.ok) return "";
    return await response.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

export async function findDomainContactEmail(website = "") {
  const host = normalizeHost(website);
  if (!host) return "";

  const root = website.replace(/\/+$/, "");
  const pages = [root, `${root}/contact`, `${root}/contact-us`, `${root}/about`, `${root}/connect`];

  for (const page of pages) {
    const html = await fetchPage(page);
    if (!html) continue;

    const emails = extractEmailsFromHtml(html, host)
      .filter((email) => normalizeHost(`https://${email.split("@")[1]}`) === host);
    if (emails[0]) {
      return emails[0];
    }
  }

  return "";
}
