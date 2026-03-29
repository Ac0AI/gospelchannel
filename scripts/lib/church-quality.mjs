const IDENTITY_KEYWORDS = [
  "church",
  "churches",
  "chapel",
  "cathedral",
  "parish",
  "fellowship",
  "assembly",
  "kyrka",
  "frikyrka",
  "forsamling",
  "församling",
  "pingst",
  "kirche",
  "gemeinde",
  "freikirche",
  "eglise",
  "église",
  "iglesia",
  "parroquia",
  "igreja",
  "seurakunta",
  "kirke",
];

const TEXT_SIGNAL_KEYWORDS = [
  ...IDENTITY_KEYWORDS,
  "gospel",
  "worship",
  "evangelical",
  "pentecostal",
  "anglican",
  "baptist",
  "community church",
  "lovsang",
  "lovsång",
  "lobpreis",
  "louange",
  "evangelique",
  "évangélique",
  "adoracion",
  "adoración",
  "evangelica",
  "evangélica",
  "louvor",
  "adoracao",
  "adoração",
  "ylistys",
];

const NEGATIVE_NAME_PATTERNS = [
  /^worship( with us| and music| & music)?$/i,
  /^services of worship$/i,
  /^places of worship$/i,
  /^churches? & cathedrals/i,
  /^calendar$/i,
  /^gemeinde$/i,
  /^församling$/i,
  /^church$/i,
  /^lobpreis$/i,
  /^lovsång/i,
  /^listado de capillas/i,
  /^barcelona$/i,
  /^stockholm$/i,
  /^malmö$/i,
  /^malmo$/i,
];

const ORGANIZATION_WORDS = [
  "alliance",
  "council",
  "network",
  "movement",
  "conference",
  "association",
  "federation",
  "union",
  "samfund",
  "organization",
];

const NEGATIVE_HOST_PATTERNS = [
  "tripadvisor.",
  "tripzilla.",
  "linkedin.",
  "fodors.",
  "visitberlin.",
  "kyrktorget.",
  "lobpreissuche.",
  "mapaosc.ipea.gov.br",
  "noticias.cancaonova.",
  "arqrio.org.br",
  "sacramentinos.com",
  "facebook.",
  "instagram.",
  "youtube.",
  "spotify.",
  "eventbrite.",
  "bandsintown.",
  "soundcloud.",
  "apple.com",
  "wikipedia.",
];

const NEGATIVE_PATH_PARTS = [
  "/event",
  "/events",
  "/calendar",
  "/sermon",
  "/blog",
  "/news",
  "/playlist",
  "/playlists",
  "/music/",
  "/worship-and-music",
  "/activities",
  "/aktivit",
  "/gottesdienste",
  "/kommun/",
  "/attractions-",
  "/category/",
  "/things-to-do/",
  "/groups/",
  "/sermons/",
];

const ROOTISH_PATH_PARTS = [
  "/",
  "/about",
  "/about-us",
  "/contact",
  "/connect",
  "/vision",
  "/visit",
  "/new-here",
  "/om",
  "/uber-uns",
  "/ueber-uns",
  "/kontakt",
];

const NON_CHURCH_PAGE_PATTERNS = [
  /worship and music/i,
  /services and times/i,
  /event details/i,
  /things to do/i,
  /activities/i,
  /calendar/i,
  /adoracion eucaristica/i,
  /adoração perp[eé]tua/i,
  /casino/i,
  /slot(s)?/i,
  /jackpot/i,
  /blackjack/i,
  /roulette/i,
  /sportsbook/i,
  /betting/i,
  /poker/i,
];

const SUSPICIOUS_MEDIA_PATTERNS = [
  /casino/i,
  /slot(s)?/i,
  /jackpot/i,
  /blackjack/i,
  /roulette/i,
  /sportsbook/i,
  /betting/i,
  /poker/i,
  /bonus/i,
  /facebook\.com\/tr(?:\/|\?|$)/i,
  /doubleclick/i,
  /google-analytics/i,
  /tracking/i,
  /(?:^|[/?#&=_-])pixel(?:[/?#&=_-]|$)/i,
  /revslider\/public\/assets\/assets\/dummy\.png/i,
  /(^|[^a-z])logo(s)?([^a-z]|$)/i,
  /(^|[^a-z])(icon|icons|avatar|favicon|brandmark|wordmark|lockup|badge)([^a-z]|$)/i,
  /(?:^|[\/_-])(logo|logos|icon|icons|avatar|favicon|brandmark|wordmark|lockup|badge)(?:[._\/-]|$)/i,
  /(?:^|[\/_-])(placeholder|dummy|default|spinner|loading|blank|spacer|transparent)(?:[._\/-]|$)/i,
  /(?:^|[\/_-])(event|events|conference|poster|flyer|brochure|bulletin|program|schedule|thumbnail|thumb)(?:[._\/-]|$)/i,
];

const BLOCKED_MEDIA_HOST_PATTERNS = [
  "facebook.com",
  "fbcdn.net",
  "instagram.com",
  "cdninstagram.com",
  "youtube.com",
  "youtu.be",
  "ytimg.com",
];

const BLOCKED_MEDIA_PATH_PARTS = [
  "/logo",
  "/logos/",
  "/icon",
  "/icons/",
  "/avatar",
  "/favicon",
  "/badge",
  "/placeholder",
  "/dummy",
  "/default",
  "/spinner",
  "/loading",
  "/blank",
  "/spacer",
  "/transparent",
  "/social/",
];

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
  /@mail\.com/i,
  /\.(png|jpg|jpeg|gif|svg|webp|css|js)$/i,
];

export function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeWhitespace(value = "") {
  return value.replace(/\s+/g, " ").trim();
}

export function decodeHtml(value = "") {
  return value
    .replace(/&#8211;|&#x2013;/gi, " - ")
    .replace(/&#8212;|&#x2014;/gi, " - ")
    .replace(/&#8217;|&#x2019;/gi, "'")
    .replace(/&#038;|&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ");
}

export function normalizeName(value = "") {
  return decodeHtml(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeHost(url = "") {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function toSiteRoot(url = "") {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}/`;
  } catch {
    return url;
  }
}

export function absoluteUrl(value = "", baseUrl = "") {
  if (!value) return "";

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return "";
  }
}

export function hasTextSignalKeyword(text = "") {
  const normalized = normalizeName(text);
  return TEXT_SIGNAL_KEYWORDS.some((keyword) => normalized.includes(normalizeName(keyword)));
}

export function hasIdentityKeyword(text = "") {
  const normalized = normalizeName(text);
  return IDENTITY_KEYWORDS.some((keyword) => normalized.includes(normalizeName(keyword)));
}

export function looksGenericName(name = "") {
  const cleaned = normalizeWhitespace(decodeHtml(name));
  return NEGATIVE_NAME_PATTERNS.some((pattern) => pattern.test(cleaned));
}

export function looksSentenceLike(name = "") {
  const cleaned = normalizeWhitespace(decodeHtml(name));
  const words = cleaned.split(/\s+/).filter(Boolean);
  return cleaned.length > 70 || words.length > 8 || /[.!?]$/.test(cleaned);
}

export function looksOrganizationLike(name = "") {
  const normalized = normalizeName(name);
  return ORGANIZATION_WORDS.some((word) => normalized.includes(word));
}

export function looksSuspiciousMediaUrl(url = "") {
  const value = String(url || "").trim();
  if (!value) return false;
  if (/^data:/i.test(value)) return true;

  try {
    const parsed = new URL(value, "https://example.org");
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const pathname = parsed.pathname.toLowerCase();
    if (BLOCKED_MEDIA_HOST_PATTERNS.some((pattern) => host.includes(pattern))) return true;
    if (BLOCKED_MEDIA_PATH_PARTS.some((fragment) => pathname.includes(fragment))) return true;
    if (/\.(svg|gif)(?:[?#]|$)/i.test(pathname)) return true;

    const query = parsed.search || "";
    const resizeMatch = `${pathname}${query}`.match(/(?:^|[^0-9])(\d{2,5})[xX](\d{2,5})(?:[^0-9]|$)/);
    const fillMatch = `${pathname}${query}`.match(/w[_=/-](\d{2,5})[,/_-]*h[_=/-](\d{2,5})/i);
    const width = Number.parseInt(
      parsed.searchParams.get("w")
      || parsed.searchParams.get("width")
      || resizeMatch?.[1]
      || fillMatch?.[1]
      || "0",
      10
    ) || 0;
    const height = Number.parseInt(
      parsed.searchParams.get("h")
      || parsed.searchParams.get("height")
      || resizeMatch?.[2]
      || fillMatch?.[2]
      || "0",
      10
    ) || 0;

    if ((width > 0 && width < 360) || (height > 0 && height < 180)) return true;
    if (width > 0 && height > 0 && width === height && width < 500) return true;
  } catch {
    return true;
  }

  return SUSPICIOUS_MEDIA_PATTERNS.some((pattern) => pattern.test(value));
}

export function isUsableHeroImageUrl(url = "") {
  return Boolean(String(url || "").trim()) && !looksSuspiciousMediaUrl(url);
}

export function isBlockedHost(host = "") {
  return NEGATIVE_HOST_PATTERNS.some((pattern) => host.includes(pattern));
}

export function looksNegativePath(url = "") {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return NEGATIVE_PATH_PARTS.some((fragment) => pathname.includes(fragment));
  } catch {
    return false;
  }
}

export function looksRootishPath(url = "") {
  try {
    const pathname = new URL(url).pathname.toLowerCase().replace(/\/+$/, "") || "/";
    return ROOTISH_PATH_PARTS.includes(pathname);
  } catch {
    return false;
  }
}

export function splitTitleParts(title = "") {
  return decodeHtml(title)
    .split(/\s*(?:\||·|>|:|\u2013|\u2014)\s*| \- /)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);
}

export function cleanNameCandidate(value = "") {
  return normalizeWhitespace(
    decodeHtml(value)
      .replace(/^welcome\s+/i, "")
      .replace(/^welcome to\s+/i, "")
      .replace(/^home\s*[:|-]\s*/i, "")
      .replace(/^official website of\s+/i, "")
      .replace(/\s+home$/i, "")
  );
}

function scoreNamePart(part = "", host = "") {
  const hostToken = host.split(".")[0]?.replace(/-/g, " ") || "";
  const cleanedPart = cleanNameCandidate(part);
  const normalized = normalizeName(cleanedPart);
  let score = 0;
  if (!normalized) score -= 10;
  if (looksGenericName(cleanedPart)) score -= 8;
  if (looksSentenceLike(cleanedPart)) score -= 4;
  if (hasIdentityKeyword(cleanedPart)) score += 5;
  else if (hasTextSignalKeyword(cleanedPart)) score += 2;
  if (hostToken && normalized.includes(normalizeName(hostToken))) score += 2;
  if (cleanedPart.length <= 42) score += 1;
  return { part: cleanedPart, score };
}

export function extractName(value = "", host = "") {
  const sourceValues = Array.isArray(value) ? value : [value];
  const scoredParts = sourceValues
    .flatMap((entry) => {
      const parts = splitTitleParts(entry);
      return parts.length > 0 ? parts : [entry];
    })
    .map((part) => {
      return scoreNamePart(part, host);
    })
    .sort((left, right) => right.score - left.score);

  if (scoredParts[0] && scoredParts[0].score > 0) {
    return scoredParts[0].part;
  }

  const fallback = host
    .split(".")[0]
    .split("-")
    .filter((part) => part.length > 1)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return fallback;
}

export function extractHeadingText(html = "", tag = "h1") {
  const pattern = new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, "gis");
  return [...html.matchAll(pattern)]
    .map((match) => normalizeWhitespace(decodeHtml((match[1] || "").replace(/<[^>]+>/g, " "))))
    .filter(Boolean);
}

function collectJsonLdNames(node, output = []) {
  if (!node) return output;
  if (Array.isArray(node)) {
    node.forEach((entry) => collectJsonLdNames(entry, output));
    return output;
  }

  if (typeof node === "object") {
    if (typeof node.name === "string") {
      output.push(normalizeWhitespace(decodeHtml(node.name)));
    }

    Object.values(node).forEach((value) => {
      if (value && typeof value === "object") {
        collectJsonLdNames(value, output);
      }
    });
  }

  return output;
}

export function extractJsonLdNames(html = "") {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis)];
  const names = [];

  for (const block of blocks) {
    const source = (block[1] || "").trim();
    if (!source) continue;

    try {
      const parsed = JSON.parse(source);
      collectJsonLdNames(parsed, names);
    } catch {
      continue;
    }
  }

  return uniqueStrings(names);
}

export function extractLocationFromText(text = "", cities = []) {
  const haystack = normalizeName(text);
  for (const city of cities) {
    if (haystack.includes(normalizeName(city))) {
      return city;
    }
  }
  return "";
}

export function normalizeEmail(email = "") {
  return email.trim().toLowerCase().replace(/^u003e/, "");
}

export function isValidOfficialEmail(email = "", host = "") {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  if (IGNORE_EMAIL_PATTERNS.some((pattern) => pattern.test(email))) return false;
  if (!host) return true;

  const normalizedHost = host.replace(/^www\./, "");
  const domain = email.split("@")[1]?.replace(/^www\./, "");
  return Boolean(domain) && (
    domain === normalizedHost
    || normalizedHost.endsWith(`.${domain}`)
    || domain.endsWith(`.${normalizedHost}`)
  );
}

export function extractEmailsFromHtml(html = "", host = "") {
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

export function extractLinks(html = "", patterns = []) {
  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((match) => match[1] || "");
  return uniqueStrings(hrefs.filter((href) => patterns.some((pattern) => pattern.test(href))));
}

export function parseTitleFromHtml(html = "") {
  const match = html.match(/<title[^>]*>(.*?)<\/title>/is);
  return match ? normalizeWhitespace(decodeHtml(match[1])) : "";
}

export function parseMetaContent(html = "", attribute = "property", value = "") {
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

export function parseCanonicalUrl(html = "", baseUrl = "") {
  const match = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i)
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["'][^>]*>/i);
  return absoluteUrl(match?.[1] || "", baseUrl);
}

export function findLikelyHeroImage(html = "", baseUrl = "") {
  const ogImage =
    parseMetaContent(html, "property", "og:image")
    || parseMetaContent(html, "name", "og:image")
    || parseMetaContent(html, "property", "twitter:image")
    || parseMetaContent(html, "name", "twitter:image");

  const absoluteOgImage = absoluteUrl(ogImage, baseUrl);
  if (isUsableHeroImageUrl(absoluteOgImage)) return absoluteOgImage;

  const imageMatches = [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => absoluteUrl(match[1] || "", baseUrl))
    .filter(Boolean)
    .filter((url) => isUsableHeroImageUrl(url))
    .filter((url) => /\.(jpg|jpeg|png|webp)(\?|$)/i.test(url));

  return imageMatches[0] || "";
}

export function extractPlainText(html = "") {
  return normalizeWhitespace(
    decodeHtml(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
    )
  );
}

export function uniqueStrings(values = []) {
  return [...new Set(values.filter(Boolean))];
}

export function tokenizeName(value = "") {
  return normalizeName(value)
    .split(/\s+/)
    .filter((token) => token.length > 2)
    .filter((token) => !["the", "and", "for", "with", "church", "worship", "music"].includes(token));
}

export function keywordOverlapScore(left = "", right = "") {
  const leftTokens = tokenizeName(left);
  const rightTokens = new Set(tokenizeName(right));
  if (leftTokens.length === 0 || rightTokens.size === 0) return 0;

  const matched = leftTokens.filter((token) => rightTokens.has(token)).length;
  return matched / Math.max(1, leftTokens.length);
}

/**
 * @param {{
 *   candidateName?: string;
 *   pageTitle?: string;
 *   nameCandidates?: string[];
 *   pageText?: string;
 *   finalUrl?: string;
 *   emails?: string[];
 *   location?: string;
 *   headerImageUrl?: string;
 * }} input
 */
export function scoreWebsiteSignals({
  candidateName = "",
  pageTitle = "",
  nameCandidates = [],
  pageText = "",
  finalUrl = "",
  emails = [],
  location = "",
  headerImageUrl = "",
}) {
  const flags = [];
  const host = normalizeHost(finalUrl);
  const extractedName = extractName(
    uniqueStrings([candidateName, pageTitle, ...nameCandidates].filter(Boolean)),
    host
  );
  const candidateNameScore = scoreNamePart(candidateName, host).score;
  const extractedNameScore = scoreNamePart(extractedName, host).score;
  const candidateNameIsWeak = looksGenericName(candidateName) || looksSentenceLike(candidateName);
  const betterName = (!candidateName || candidateNameIsWeak || extractedNameScore > candidateNameScore)
    ? extractedName
    : candidateName;
  let score = 0.24;

  if (!host) {
    flags.push("missing_host");
    score -= 0.3;
  }

  if (isBlockedHost(host)) {
    flags.push("blocked_host");
    score -= 0.95;
  }

  if (looksNegativePath(finalUrl)) {
    flags.push("non_root_page");
    score -= 0.3;
  } else if (looksRootishPath(finalUrl)) {
    score += 0.06;
  }

  if (hasIdentityKeyword(pageTitle)) score += 0.2;
  else if (hasTextSignalKeyword(pageTitle)) score += 0.08;
  else flags.push("missing_identity_keyword");

  if (hasIdentityKeyword(pageText)) score += 0.14;
  else if (hasTextSignalKeyword(pageText)) score += 0.06;
  else flags.push("weak_body_signals");

  if (emails.length > 0) score += 0.08;
  else flags.push("missing_official_email");

  if (location) score += 0.04;
  else flags.push("missing_location");

  if (headerImageUrl) {
    if (looksSuspiciousMediaUrl(headerImageUrl)) {
      flags.push("suspicious_header_image");
      score -= 0.08;
    } else {
      score += 0.03;
    }
  } else flags.push("header_image_missing");

  if (looksGenericName(betterName)) {
    flags.push("generic_title");
    score -= 0.45;
  }

  if (looksSentenceLike(betterName)) {
    flags.push("sentence_title");
    score -= 0.24;
  }

  if (looksOrganizationLike(betterName) && !hasIdentityKeyword(betterName)) {
    flags.push("organization_not_church");
    score -= 0.22;
  }

  if (NON_CHURCH_PAGE_PATTERNS.some((pattern) => pattern.test(finalUrl) || pattern.test(pageTitle) || pattern.test(pageText))) {
    flags.push("non_church_page");
    score -= 0.22;
  }

  return {
    betterName,
    score: clamp(score),
    flags: uniqueStrings(flags),
  };
}
