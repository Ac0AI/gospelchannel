#!/usr/bin/env node

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  addChurchToIndex,
  createChurchIndex,
  decodeHtml,
  findChurchDuplicate,
  isOfficialWebsiteUrl,
  normalizeHost,
  normalizeName,
  normalizeWhitespace,
  slugifyName,
  toSiteRoot,
} from "./lib/church-intake-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const CHURCHES_PATH = join(ROOT_DIR, "src", "data", "churches.json");

const DEFAULT_COUNTRIES = ["SE", "GB", "DE", "FR", "CH", "NO", "DK", "FI", "ES", "BR", "PH", "NG"];
const DEFAULT_DAILY_TARGET = 250;
const DEFAULT_QUERIES_PER_COUNTRY = 20;
const DEFAULT_MAX_PAGES = 2;
const DEFAULT_VERIFICATION_CONCURRENCY = 8;

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
  "församling",
  "pingst",
  "kirche",
  "gemeinde",
  "freikirche",
  "église",
  "eglise",
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
  "lovsång",
  "lobpreis",
  "louange",
  "évangélique",
  "evangelique",
  "adoración",
  "adoracion",
  "evangélica",
  "evangelica",
  "louvor",
  "adoração",
  "adoracao",
  "ylistys",
  "lovsang",
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
  "ticket",
  "eventbrite.",
  "bandsintown.",
  "apple.com",
  "soundcloud.",
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
];

const COUNTRY_PACKS = {
  SE: {
    country: "Sweden",
    googleCountryCode: "SE",
    languageCode: "sv",
    cities: ["Stockholm", "Göteborg", "Malmö", "Uppsala", "Jönköping", "Örebro", "Linköping", "Västerås", "Norrköping", "Umeå", "Lund", "Borås"],
    nationalQueries: ["Sverige kyrka lovsång", "Sverige frikyrka worship", "Sverige pingstkyrka lovsång", "Sverige karismatisk kyrka", "Sverige församling spotify"],
    cityTemplates: ["{city} kyrka lovsång", "{city} frikyrka lovsång", "{city} church worship", "{city} pingstkyrka"],
  },
  GB: {
    country: "United Kingdom",
    googleCountryCode: "GB",
    languageCode: "en",
    cities: ["London", "Birmingham", "Manchester", "Bristol", "Leeds", "Glasgow", "Edinburgh", "Liverpool", "Sheffield", "Nottingham", "Cardiff", "Belfast"],
    nationalQueries: ["United Kingdom evangelical church worship", "England charismatic church worship", "UK church spotify worship", "UK pentecostal church worship music", "UK church worship team"],
    cityTemplates: ["{city} evangelical church worship", "{city} church worship", "{city} worship church", "{city} charismatic church"],
  },
  DE: {
    country: "Germany",
    googleCountryCode: "DE",
    languageCode: "de",
    cities: ["Berlin", "Hamburg", "Cologne", "Munich", "Frankfurt", "Stuttgart", "Düsseldorf", "Leipzig", "Dresden", "Hannover", "Nürnberg", "Bremen"],
    nationalQueries: ["Deutschland freikirche lobpreis", "Deutschland kirche worship", "Deutschland pfingstkirche lobpreis", "Deutschland charismatische gemeinde worship", "Deutschland kirche spotify"],
    cityTemplates: ["{city} freikirche lobpreis", "{city} kirche worship", "{city} pfingstkirche lobpreis", "{city} gemeinde worship"],
  },
  FR: {
    country: "France",
    googleCountryCode: "FR",
    languageCode: "fr",
    cities: ["Paris", "Lyon", "Marseille", "Lille", "Toulouse", "Strasbourg", "Bordeaux", "Nantes", "Nice", "Montpellier", "Rennes", "Grenoble"],
    nationalQueries: ["France église évangélique louange", "France église worship", "France église gospel", "France église pentecôtiste louange", "France église spotify worship"],
    cityTemplates: ["{city} église évangélique louange", "{city} église worship", "{city} église gospel", "{city} église pentecôtiste"],
  },
  CH: {
    country: "Switzerland",
    googleCountryCode: "CH",
    languageCode: "de",
    cities: ["Zurich", "Geneva", "Basel", "Lausanne", "Bern", "Lucerne", "St. Gallen", "Winterthur", "Lugano", "Thun"],
    nationalQueries: ["Schweiz freikirche lobpreis", "Suisse église évangélique louange", "Switzerland church worship", "Schweiz gemeinde worship", "Suisse église gospel"],
    cityTemplates: ["{city} freikirche lobpreis", "{city} église évangélique louange", "{city} church worship", "{city} gemeinde worship"],
  },
  NO: {
    country: "Norway",
    googleCountryCode: "NO",
    languageCode: "no",
    cities: ["Oslo", "Bergen", "Stavanger", "Trondheim", "Kristiansand", "Drammen", "Fredrikstad", "Tromsø", "Sandnes", "Bodø"],
    nationalQueries: ["Norge kirke lovsang", "Norge frikirke lovsang", "Norway church worship", "Norge pinsemenighet lovsang", "Norge menighet spotify"],
    cityTemplates: ["{city} kirke lovsang", "{city} frikirke lovsang", "{city} church worship", "{city} pinsemenighet"],
  },
  DK: {
    country: "Denmark",
    googleCountryCode: "DK",
    languageCode: "da",
    cities: ["Copenhagen", "Aarhus", "Odense", "Aalborg", "Esbjerg", "Randers", "Kolding", "Horsens", "Vejle", "Roskilde"],
    nationalQueries: ["Danmark kirke lovsang", "Danmark frikirke lovsang", "Denmark church worship", "Danmark pinsemenighed lovsang", "Danmark menighed worship"],
    cityTemplates: ["{city} kirke lovsang", "{city} frikirke lovsang", "{city} church worship", "{city} pinsemenighed"],
  },
  FI: {
    country: "Finland",
    googleCountryCode: "FI",
    languageCode: "fi",
    cities: ["Helsinki", "Espoo", "Tampere", "Turku", "Oulu", "Vantaa", "Jyväskylä", "Kuopio", "Lahti", "Rovaniemi"],
    nationalQueries: ["Suomi seurakunta ylistys", "Suomi vapaa seurakunta ylistys", "Finland church worship", "Suomi helluntaiseurakunta ylistys", "Suomi seurakunta spotify"],
    cityTemplates: ["{city} seurakunta ylistys", "{city} vapaa seurakunta ylistys", "{city} church worship", "{city} helluntaiseurakunta"],
  },
  ES: {
    country: "Spain",
    googleCountryCode: "ES",
    languageCode: "es",
    cities: ["Madrid", "Barcelona", "Valencia", "Málaga", "Sevilla", "Bilbao", "Zaragoza", "Murcia", "Palma", "Las Palmas", "Alicante", "Granada"],
    nationalQueries: ["España iglesia evangélica adoración", "España iglesia worship", "España iglesia spotify worship", "España iglesia pentecostal adoración", "España iglesia gospel"],
    cityTemplates: ["{city} iglesia evangélica adoración", "{city} iglesia worship", "{city} church worship", "{city} iglesia pentecostal"],
  },
  BR: {
    country: "Brazil",
    googleCountryCode: "BR",
    languageCode: "pt-BR",
    cities: ["São Paulo", "Rio de Janeiro", "Belo Horizonte", "Curitiba", "Recife", "Porto Alegre", "Brasília", "Salvador", "Fortaleza", "Manaus", "Goiânia", "Campinas"],
    nationalQueries: ["Brasil igreja evangélica louvor", "Brasil igreja worship", "Brasil igreja spotify worship", "Brasil igreja pentecostal louvor", "Brasil igreja gospel adoração"],
    cityTemplates: ["{city} igreja evangélica louvor", "{city} igreja worship", "{city} igreja pentecostal louvor", "{city} igreja gospel"],
  },
  PH: {
    country: "Philippines",
    googleCountryCode: "PH",
    languageCode: "en",
    cities: ["Manila", "Quezon City", "Cebu", "Davao", "Pasig", "Makati", "Taguig", "Cagayan de Oro", "Iloilo", "Bacolod"],
    nationalQueries: ["Philippines evangelical church worship", "Philippines gospel church worship", "Philippines church spotify worship", "Philippines pentecostal church worship", "Philippines church worship team"],
    cityTemplates: ["{city} evangelical church worship", "{city} church worship", "{city} gospel church worship", "{city} pentecostal church"],
  },
  NG: {
    country: "Nigeria",
    googleCountryCode: "NG",
    languageCode: "en",
    cities: ["Lagos", "Abuja", "Port Harcourt", "Ibadan", "Enugu", "Benin City", "Kano", "Kaduna", "Jos", "Calabar", "Uyo", "Owerri"],
    nationalQueries: ["Nigeria evangelical church worship", "Nigeria pentecostal church worship", "Nigeria gospel church worship", "Nigeria church worship team spotify", "Nigeria charismatic church worship"],
    cityTemplates: ["{city} evangelical church worship", "{city} pentecostal church worship", "{city} gospel church worship", "{city} charismatic church"],
  },
};

function loadLocalEnv() {
  for (const filename of [".env.local", ".env"]) {
    const filePath = join(ROOT_DIR, filename);
    if (!existsSync(filePath)) continue;

    const source = readFileSync(filePath, "utf8");
    for (const line of source.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator <= 0) continue;
      const key = trimmed.slice(0, separator).trim();
      if (process.env[key]) continue;
      let value = trimmed.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

function parseArgs(argv) {
  const options = {
    countries: DEFAULT_COUNTRIES,
    dailyTarget: DEFAULT_DAILY_TARGET,
    queriesPerCountry: DEFAULT_QUERIES_PER_COUNTRY,
    maxPages: DEFAULT_MAX_PAGES,
    preview: false,
    verificationConcurrency: DEFAULT_VERIFICATION_CONCURRENCY,
  };

  for (const arg of argv) {
    if (arg === "--preview") options.preview = true;
    else if (arg.startsWith("--countries=")) {
      const value = arg.split("=")[1] || "";
      options.countries = value === "all"
        ? Object.keys(COUNTRY_PACKS)
        : value.split(",").map((entry) => entry.trim().toUpperCase()).filter(Boolean);
    } else if (arg.startsWith("--daily-target=")) {
      options.dailyTarget = Math.max(1, Number(arg.split("=")[1]) || DEFAULT_DAILY_TARGET);
    } else if (arg.startsWith("--queries-per-country=")) {
      options.queriesPerCountry = Math.max(3, Number(arg.split("=")[1]) || DEFAULT_QUERIES_PER_COUNTRY);
    } else if (arg.startsWith("--max-pages=")) {
      options.maxPages = Math.max(1, Number(arg.split("=")[1]) || DEFAULT_MAX_PAGES);
    } else if (arg.startsWith("--verification-concurrency=")) {
      options.verificationConcurrency = Math.max(1, Number(arg.split("=")[1]) || DEFAULT_VERIFICATION_CONCURRENCY);
    }
  }

  options.countries = options.countries.filter((code) => Boolean(COUNTRY_PACKS[code]));
  if (options.countries.length === 0) {
    throw new Error("No valid countries selected");
  }

  return options;
}

function slugify(name) {
  return slugifyName(cleanNameCandidate(decodeHtml(name)), "church");
}

function hasTextSignalKeyword(text = "") {
  const normalized = normalizeName(text);
  return TEXT_SIGNAL_KEYWORDS.some((keyword) => normalized.includes(normalizeName(keyword)));
}

function hasIdentityKeyword(text = "") {
  const normalized = normalizeName(text);
  return IDENTITY_KEYWORDS.some((keyword) => normalized.includes(normalizeName(keyword)));
}

function looksGenericName(name = "") {
  const cleaned = normalizeWhitespace(decodeHtml(name));
  return NEGATIVE_NAME_PATTERNS.some((pattern) => pattern.test(cleaned));
}

function looksSentenceLike(name = "") {
  const cleaned = normalizeWhitespace(decodeHtml(name));
  const words = cleaned.split(/\s+/).filter(Boolean);
  return cleaned.length > 70 || words.length > 8 || /[.!?]$/.test(cleaned);
}

function looksOrganizationLike(name = "") {
  const normalized = normalizeName(name);
  return ORGANIZATION_WORDS.some((word) => normalized.includes(word));
}

function isBlockedHost(host = "") {
  return NEGATIVE_HOST_PATTERNS.some((pattern) => host.includes(pattern));
}

function looksNegativePath(url = "") {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return NEGATIVE_PATH_PARTS.some((fragment) => pathname.includes(fragment));
  } catch {
    return false;
  }
}

function looksRootishPath(url = "") {
  try {
    const pathname = new URL(url).pathname.toLowerCase().replace(/\/+$/, "") || "/";
    return ROOTISH_PATH_PARTS.includes(pathname);
  } catch {
    return false;
  }
}

function splitTitleParts(title = "") {
  return decodeHtml(title)
    .split(/\s[|·:-]\s| \u2013 | \u2014 /)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);
}

function cleanNameCandidate(value = "") {
  return normalizeWhitespace(
    decodeHtml(value)
      .replace(/^welcome to\s+/i, "")
      .replace(/^home\s*[:|-]\s*/i, "")
      .replace(/^official website of\s+/i, "")
  );
}

function extractName(title = "", host = "") {
  const hostToken = host.split(".")[0]?.replace(/-/g, " ") || "";
  const scoredParts = splitTitleParts(title)
    .map((part) => {
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

function extractLocationFromText(text = "", cities = []) {
  const haystack = normalizeName(text);
  for (const city of cities) {
    if (haystack.includes(normalizeName(city))) {
      return city;
    }
  }
  return "";
}

function buildQueriesForCountry(code, limit) {
  const pack = COUNTRY_PACKS[code];
  const queries = [];

  for (const query of pack.nationalQueries) {
    queries.push({ query, city: "", countryCode: code });
    if (queries.length >= limit) return queries;
  }

  for (const city of pack.cities) {
    for (const template of pack.cityTemplates) {
      queries.push({ query: template.replace("{city}", city), city, countryCode: code });
      if (queries.length >= limit) return queries;
    }
  }

  return queries;
}

async function runApifyCountrySearch(pack, queries, maxPages) {
  const token = process.env.APIFY_TOKEN;
  const response = await fetch("https://api.apify.com/v2/acts/apify~google-search-scraper/run-sync-get-dataset-items", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      queries: queries.map((entry) => entry.query).join("\n"),
      countryCode: pack.googleCountryCode.toLowerCase(),
      languageCode: pack.languageCode,
      maxPagesPerQuery: maxPages,
      resultsPerPage: 10,
      mobileResults: false,
      includeUnfilteredResults: false,
      saveHtml: false,
      saveHtmlToKeyValueStore: false,
      maxConcurrency: 10,
    }),
  });

  if (!response.ok) {
    throw new Error(`Apify search failed for ${pack.country}: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

function flattenOrganicResults(items = []) {
  const rows = [];

  for (const item of items) {
    const organicResults = Array.isArray(item.organicResults)
      ? item.organicResults
      : Array.isArray(item.nonPromotedSearchResults)
        ? item.nonPromotedSearchResults
        : [];

    if (organicResults.length === 0 && item.url && item.title) {
      rows.push({
        query: item.searchQuery?.term || "",
        countryCode: item.searchQuery?.countryCode || "",
        title: item.title,
        url: item.url,
        description: item.description || item.snippet || "",
        position: item.position || 1,
      });
      continue;
    }

    for (const result of organicResults) {
      rows.push({
        query: item.searchQuery?.term || "",
        countryCode: item.searchQuery?.countryCode || "",
        title: result.title || "",
        url: result.url || result.link || "",
        description: result.description || result.snippet || "",
        position: Number(result.position || result.rank || 0),
      });
    }
  }

  return rows;
}

function estimateSearchScore(result, queryMeta, pack) {
  const host = normalizeHost(result.url);
  const title = normalizeWhitespace(decodeHtml(result.title || ""));
  const description = normalizeWhitespace(decodeHtml(result.description || ""));
  const name = extractName(title, host);
  const text = `${title} ${description}`;
  let score = 0.15;

  if (!host || isBlockedHost(host)) score -= 0.8;
  else score += 0.1;

  if (hasIdentityKeyword(text)) score += 0.2;
  else if (hasTextSignalKeyword(text)) score += 0.1;
  if (hasIdentityKeyword(name)) score += 0.16;
  else if (hasTextSignalKeyword(name)) score += 0.06;

  if (looksRootishPath(result.url)) score += 0.08;
  if (looksNegativePath(result.url)) score -= 0.25;

  if (queryMeta.city && extractLocationFromText(`${title} ${description} ${result.url}`, pack.cities) === queryMeta.city) {
    score += 0.06;
  }

  if (result.position > 0 && result.position <= 3) score += 0.05;
  if (looksGenericName(name)) score -= 0.5;
  if (looksSentenceLike(name)) score -= 0.35;
  if (looksOrganizationLike(name) && !hasIdentityKeyword(name)) score -= 0.3;
  if (!name || name.length < 4) score -= 0.3;

  return {
    name,
    host,
    website: toSiteRoot(result.url),
    location: queryMeta.city && extractLocationFromText(`${title} ${description}`, pack.cities) ? queryMeta.city : "",
    score: Math.max(0, Math.min(1, score)),
    title,
    description,
  };
}

async function fetchText(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0)" },
      redirect: "follow",
    });
    if (!response.ok) return "";
    return await response.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

function extractEmails(html = "", host = "") {
  const matches = html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [];
  const normalizedHost = host.replace(/^www\./, "");
  return [...new Set(matches.map((email) => email.trim().toLowerCase()))]
    .filter((email) => !IGNORE_EMAIL_PATTERNS.some((pattern) => pattern.test(email)))
    .filter((email) => {
      const domain = email.split("@")[1]?.replace(/^www\./, "");
      return Boolean(domain) && domain === normalizedHost;
    })
    .sort((left, right) => {
      const leftPreferred = /^(info|hello|contact|office|worship|music)@/.test(left) ? 1 : 0;
      const rightPreferred = /^(info|hello|contact|office|worship|music)@/.test(right) ? 1 : 0;
      return rightPreferred - leftPreferred;
    });
}

function extractTitleFromHtml(html = "") {
  const match = html.match(/<title[^>]*>(.*?)<\/title>/is);
  return match ? normalizeWhitespace(decodeHtml(match[1])) : "";
}

async function verifyCandidate(candidate, pack) {
  const homepageHtml = await fetchText(candidate.website);
  if (!homepageHtml) {
    return candidate;
  }

  const host = normalizeHost(candidate.website);
  const homepageTitle = extractTitleFromHtml(homepageHtml);
  const contactHtml = await fetchText(new URL("/contact", candidate.website).toString());
  const emailCandidates = [
    ...extractEmails(homepageHtml, host),
    ...extractEmails(contactHtml, host),
  ];

  const location = candidate.location || extractLocationFromText(homepageTitle, pack.cities);
  const betterName = extractName(homepageTitle || candidate.name, host);
  let confidence = candidate.confidence;

  if (homepageTitle && hasIdentityKeyword(homepageTitle)) confidence += 0.08;
  else if (homepageTitle && hasTextSignalKeyword(homepageTitle)) confidence += 0.04;
  if (emailCandidates.length > 0) confidence += 0.05;
  if (location) confidence += 0.04;
  if (looksGenericName(betterName)) confidence -= 0.2;
  if (looksSentenceLike(betterName)) confidence -= 0.25;
  if (looksOrganizationLike(betterName) && !hasIdentityKeyword(betterName)) confidence -= 0.2;

  return {
    ...candidate,
    name: !looksGenericName(betterName) && !looksSentenceLike(betterName) ? betterName : candidate.name,
    contactEmail: emailCandidates[0] || candidate.contactEmail,
    location,
    confidence: Math.max(0, Math.min(1, confidence)),
  };
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function loadExistingChurches() {
  const rows = JSON.parse(readFileSync(CHURCHES_PATH, "utf8"));
  const index = createChurchIndex();

  for (const row of rows) {
    addChurchToIndex(index, row);
  }

  return index;
}

async function loadExistingCandidates(supabase) {
  const index = createChurchIndex();
  let from = 0;
  const PAGE_SIZE = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("churches")
      .select("name,website,country,location,status")
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    for (const row of data || []) {
      addChurchToIndex(index, row);
    }

    if (!data || data.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return index;
}

function summarizeReasons(reasons) {
  return [...reasons].slice(0, 3).join(" | ");
}

async function main() {
  loadLocalEnv();
  const options = parseArgs(process.argv.slice(2));

  if (!process.env.APIFY_TOKEN) {
    throw new Error("Missing APIFY_TOKEN");
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    throw new Error("Missing Supabase environment variables");
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const existingChurches = loadExistingChurches();
  const existingCandidates = await loadExistingCandidates(supabase);
  const seenIndex = createChurchIndex();
  for (const rows of existingChurches.byHost.values()) rows.forEach((row) => addChurchToIndex(seenIndex, row));
  for (const rows of existingChurches.byNameCountry.values()) rows.forEach((row) => addChurchToIndex(seenIndex, row));
  for (const rows of existingCandidates.byHost.values()) rows.forEach((row) => addChurchToIndex(seenIndex, row));
  for (const rows of existingCandidates.byNameCountry.values()) rows.forEach((row) => addChurchToIndex(seenIndex, row));

  const provisional = [];
  const provisionalIndex = createChurchIndex();

  console.log(`Discovering across ${options.countries.join(", ")} with daily target ${options.dailyTarget}`);

  for (const countryCode of options.countries) {
    const pack = COUNTRY_PACKS[countryCode];
    const queryBatch = buildQueriesForCountry(countryCode, options.queriesPerCountry);
    console.log(`\n${pack.country}: running ${queryBatch.length} search queries`);

    const response = await runApifyCountrySearch(pack, queryBatch, options.maxPages);
    const searchRows = flattenOrganicResults(response);
    console.log(`  received ${searchRows.length} organic results`);

    const queryMetaByTerm = new Map(queryBatch.map((entry) => [entry.query, entry]));

    for (const row of searchRows) {
      const queryMeta = queryMetaByTerm.get(row.query) || { city: "", query: row.query };
      const estimate = estimateSearchScore(row, queryMeta, pack);
      if (estimate.score < 0.45) continue;
      if (!estimate.host || isBlockedHost(estimate.host)) continue;
      if (!isOfficialWebsiteUrl(estimate.website)) continue;
      if (looksGenericName(estimate.name)) continue;

      const candidate = {
        name: estimate.name,
        website: estimate.website,
        location: estimate.location,
        country: pack.country,
      };

      if (findChurchDuplicate(seenIndex, candidate)) {
        continue;
      }

      const existing = findChurchDuplicate(provisionalIndex, candidate);
      if (existing) {
        existing.confidence = Math.max(existing.confidence, estimate.score);
        existing.reasons.add(`${pack.country}: ${row.query}`);
        if (!existing.location && estimate.location) existing.location = estimate.location;
        if (estimate.name.length > existing.name.length && !looksGenericName(estimate.name)) {
          existing.name = estimate.name;
        }
        continue;
      }

      const record = {
        name: estimate.name,
        website: estimate.website,
        contactEmail: "",
        location: estimate.location,
        country: pack.country,
        countryCode,
        confidence: estimate.score,
        reasons: new Set([`${pack.country}: ${row.query}`]),
        source: "google-search",
      };

      provisional.push(record);
      addChurchToIndex(provisionalIndex, record);
    }
  }

  const provisionalRows = [...provisional]
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, options.dailyTarget * 2);

  console.log(`\nShortlisted ${provisionalRows.length} hosts before verification`);

  const verifiedRows = await mapWithConcurrency(
    provisionalRows,
    options.verificationConcurrency,
    async (candidate) => verifyCandidate(candidate, COUNTRY_PACKS[candidate.countryCode] || COUNTRY_PACKS[options.countries[0]])
  );

  const dedupedRows = [];
  const dedupedIndex = createChurchIndex();
  for (const candidate of verifiedRows) {
    const existing = findChurchDuplicate(dedupedIndex, candidate);
    if (!existing) {
      dedupedRows.push(candidate);
      addChurchToIndex(dedupedIndex, candidate);
      continue;
    }

    if (candidate.confidence > existing.confidence) {
      const index = dedupedRows.indexOf(existing);
      if (index >= 0) dedupedRows[index] = candidate;
      const refreshedIndex = createChurchIndex();
      for (const row of dedupedRows) addChurchToIndex(refreshedIndex, row);
      dedupedIndex.byHost = refreshedIndex.byHost;
      dedupedIndex.byNameCountry = refreshedIndex.byNameCountry;
    }
  }

  const finalRows = [...dedupedRows]
    .filter((candidate) => candidate.confidence >= 0.58)
    .filter((candidate) => !looksGenericName(candidate.name))
    .filter((candidate) => !looksSentenceLike(candidate.name))
    .filter((candidate) => !(looksOrganizationLike(candidate.name) && !hasIdentityKeyword(candidate.name)))
    .filter((candidate) => {
      const hasIdentity = hasIdentityKeyword(candidate.name);
      const hasLocation = Boolean(candidate.location);
      // High confidence (>=0.72) can pass with either identity keyword or location
      // Medium confidence requires both
      if (candidate.confidence >= 0.72) return hasIdentity || hasLocation;
      return hasIdentity && hasLocation;
    })
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, options.dailyTarget)
    .map((candidate) => {
      const name = candidate.name;
      return {
        slug: slugify(name),
        name,
        description: "",
        website: candidate.website,
        email: candidate.contactEmail || null,
        location: candidate.location || null,
        country: candidate.country || "",
        confidence: Number(candidate.confidence.toFixed(2)),
        reason: summarizeReasons(candidate.reasons),
        discovery_source: "google-search",
        source_kind: "discovered",
        status: "pending",
      };
    });

  console.log(`Accepted ${finalRows.length} candidates after verification`);

  const previewRows = finalRows.slice(0, 20).map((row) => ({
    name: row.name,
    country: row.country,
    location: row.location,
    confidence: row.confidence,
    website: row.website,
    email: row.email,
  }));
  console.log(JSON.stringify(previewRows, null, 2));

  if (options.preview || finalRows.length === 0) {
    console.log(options.preview ? "\nPreview mode: nothing inserted." : "\nNothing to insert.");
    return;
  }

  const { error } = await supabase.from("churches").upsert(finalRows, { onConflict: "slug", ignoreDuplicates: true });
  if (error) throw error;

  console.log(`\nInserted ${finalRows.length} candidates.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
