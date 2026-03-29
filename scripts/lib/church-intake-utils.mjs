const SOCIAL_HOST_PATTERNS = [
  "facebook.com",
  "instagram.com",
  "youtube.com",
  "youtu.be",
  "spotify.com",
  "soundcloud.com",
  "linktr.ee",
  "tiktok.com",
  "x.com",
  "twitter.com",
];

export function normalizeWhitespace(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export function decodeHtml(value = "") {
  return String(value)
    .replace(/&#8211;|&#x2013;/gi, " - ")
    .replace(/&#8212;|&#x2014;/gi, " - ")
    .replace(/&#8217;|&#x2019;/gi, "'")
    .replace(/&#038;|&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&raquo;/gi, "»")
    .replace(/&laquo;/gi, "«");
}

export function normalizeName(value = "") {
  return decodeHtml(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function cleanSlugPart(value = "") {
  return decodeHtml(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
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

export function normalizeLocationKey(value = "") {
  return decodeHtml(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b\d{3,}\b/g, " ")
    .trim();
}

export function buildNameCountryKey(name = "", country = "") {
  const normalizedName = normalizeName(name);
  const normalizedCountry = normalizeWhitespace(country).toLowerCase();
  if (!normalizedName || !normalizedCountry) return "";
  return `${normalizedName}|${normalizedCountry}`;
}

export function slugifyName(name = "", fallback = "church") {
  const slug = cleanSlugPart(name).slice(0, 80);
  return slug || fallback;
}

export function isOfficialWebsiteUrl(url = "") {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (!/^https?:$/i.test(parsed.protocol)) {
    return false;
  }

  const host = normalizeHost(parsed.toString());
  if (!host) return false;
  return !SOCIAL_HOST_PATTERNS.some((pattern) => host === pattern || host.endsWith(`.${pattern}`));
}

function hasSameLocation(left, right) {
  const leftLocation = normalizeLocationKey(left.location || "");
  const rightLocation = normalizeLocationKey(right.location || "");
  return Boolean(leftLocation) && leftLocation === rightLocation;
}

function hasDistinctCampus(left, right) {
  const leftLocation = normalizeLocationKey(left.location || "");
  const rightLocation = normalizeLocationKey(right.location || "");
  return Boolean(leftLocation) && Boolean(rightLocation) && leftLocation !== rightLocation;
}

export function areChurchesDuplicate(left, right) {
  const sameName = normalizeName(left.name) === normalizeName(right.name);
  if (!sameName) return false;

  const sameCountry = normalizeWhitespace(left.country).toLowerCase() === normalizeWhitespace(right.country).toLowerCase();
  const sameHost = normalizeHost(left.website || left.url || "") === normalizeHost(right.website || right.url || "");

  if (sameCountry && hasSameLocation(left, right)) {
    return true;
  }

  if (sameHost) {
    return !hasDistinctCampus(left, right);
  }

  if (sameCountry) {
    const leftLocation = normalizeLocationKey(left.location || "");
    const rightLocation = normalizeLocationKey(right.location || "");
    return !leftLocation || !rightLocation;
  }

  return false;
}

export function createChurchIndex() {
  return {
    byHost: new Map(),
    byNameCountry: new Map(),
  };
}

export function addChurchToIndex(index, church) {
  const host = normalizeHost(church.website || church.url || "");
  if (host) {
    const rows = index.byHost.get(host) || [];
    rows.push(church);
    index.byHost.set(host, rows);
  }

  const nameCountryKey = buildNameCountryKey(church.name, church.country);
  if (nameCountryKey) {
    const rows = index.byNameCountry.get(nameCountryKey) || [];
    rows.push(church);
    index.byNameCountry.set(nameCountryKey, rows);
  }
}

export function findChurchDuplicate(index, church) {
  const matches = [];
  const seen = new Set();

  const host = normalizeHost(church.website || church.url || "");
  if (host) {
    for (const row of index.byHost.get(host) || []) {
      const key = `${row.name}|${row.country}|${row.location}|${row.website || row.url || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push(row);
    }
  }

  const nameCountryKey = buildNameCountryKey(church.name, church.country);
  if (nameCountryKey) {
    for (const row of index.byNameCountry.get(nameCountryKey) || []) {
      const key = `${row.name}|${row.country}|${row.location}|${row.website || row.url || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push(row);
    }
  }

  return matches.find((row) => areChurchesDuplicate(row, church)) || null;
}
