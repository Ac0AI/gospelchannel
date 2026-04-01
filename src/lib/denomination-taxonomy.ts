/**
 * Canonical denomination taxonomy.
 * Single source of truth for categorizing churches by tradition.
 * Used for: directory filters, normalization at ingest, and data cleanup.
 */

export type DenominationCategory = {
  slug: string;
  label: string;
  canonical: string;
  match: string[];
  networks?: string[];
};

/**
 * Order matters: first match wins in normalizeDenomination().
 * More specific categories (pentecostal, baptist) should come before
 * broader ones (evangelical, charismatic).
 */
export const DENOMINATIONS: DenominationCategory[] = [
  {
    slug: "pentecostal",
    label: "Pentecostal",
    canonical: "Pentecostal",
    match: [
      "pentecostal", "pingst", "pingstförsamling", "pingstkyrka",
      "assemblies of god", "asambleas de dios", "assembleia de deus",
      "assemblées de dieu", "elim", "foursquare", "apostolic",
      "church of god", "redeemed christian",
    ],
    networks: [
      "Assemblies of God", "Pingst", "Pingstkyrkan", "Pingstförsamlingen",
      "Elim", "The Foursquare Church", "Foursquare Church",
      "Church of God", "Redeemed Christian Church of God",
      "Church of Pentecost",
    ],
  },
  {
    slug: "charismatic",
    label: "Charismatic",
    canonical: "Charismatic",
    match: ["charismatic", "spirit-filled", "full gospel"],
    networks: [
      "Every Nation", "Hillsong Church", "Hillsong Network",
      "C3 Church Global", "C3 Church", "C3 Church Movement", "C3 Church Network",
      "Planetshakers", "Bethel", "Newfrontiers", "ICF Movement", "ICF Church",
      "Vineyard", "Vineyard Churches", "Vineyard Movement",
      "Winners Chapel", "Christ Embassy",
    ],
  },
  {
    slug: "baptist",
    label: "Baptist",
    canonical: "Baptist",
    match: ["baptist", "battista"],
    networks: [
      "Southern Baptist Convention", "Baptist Union",
      "International Baptist Convention", "Calvary Chapel",
      "Swiss Baptist Union",
    ],
  },
  {
    slug: "anglican",
    label: "Anglican",
    canonical: "Anglican",
    match: [
      "anglican", "church of england", "church in wales",
      "episcopal", "church of ireland",
    ],
    networks: [
      "Church of England", "Anglican Communion",
      "Diocese in Europe", "Church in Wales",
    ],
  },
  {
    slug: "lutheran",
    label: "Lutheran",
    canonical: "Lutheran",
    match: ["lutheran", "luthersk", "lutherisch", "luthérien"],
    networks: [
      "Church of Sweden", "Church of Norway", "Church of Denmark",
      "Evangelical Lutheran Church in Denmark",
      "Evangelical Lutheran Church of Finland",
      "Evangelical Lutheran Church in Germany (EKD)", "EKD",
      "Evangelical Lutheran Church in America",
    ],
  },
  {
    slug: "catholic",
    label: "Catholic",
    canonical: "Catholic",
    match: ["catholic", "katolsk", "katholisch", "catholique", "cattolica"],
    networks: ["Catholic Church", "Roman Catholic Church"],
  },
  {
    slug: "methodist",
    label: "Methodist",
    canonical: "Methodist",
    match: [
      "methodist", "wesleyan", "nazarene",
      "salvation army", "frälsningsarmén", "frelsesarmeen",
    ],
    networks: [
      "Methodist Church", "Salvation Army",
      "Church of the Nazarene", "Free Methodist Church",
    ],
  },
  {
    slug: "reformed",
    label: "Reformed",
    canonical: "Reformed",
    match: ["reformed", "presbyterian", "calvinist", "reformiert", "réformée"],
    networks: [
      "Church of Scotland", "Presbyterian Church",
      "United Reformed Church", "Christian Reformed Church",
    ],
  },
  {
    slug: "evangelical",
    label: "Evangelical",
    canonical: "Evangelical",
    match: [
      "evangelical", "evangelisk", "evangelisch", "évangélique",
      "evangelical free", "frikyrklig",
    ],
    networks: ["Evangelical Free Church", "Evangelical Alliance", "CNEF"],
  },
  {
    slug: "non-denominational",
    label: "Non-denominational",
    canonical: "Non-denominational",
    match: [
      "non-denominational", "nondenominational",
      "interdenominational", "undenominational",
    ],
  },
  {
    slug: "orthodox",
    label: "Orthodox",
    canonical: "Orthodox",
    match: ["orthodox", "ortodoxa", "ortodox"],
  },
];

const UNDERSCORE_MAP: Record<string, string> = {
  salvation_army: "Methodist",
  roman_catholic: "Catholic",
  church_in_wales: "Anglican",
  latter_day_saints: "Non-denominational",
  christadelphian: "Non-denominational",
  quaker: "Non-denominational",
  united_reformed: "Reformed",
};

/**
 * Normalize a raw denomination string to a canonical value.
 * "assemblies of god" → "Pentecostal"
 * "salvation_army" → "Methodist"
 * "Anglican" → "Anglican"
 * Returns the canonical denomination or the original input title-cased if no match.
 */
export function normalizeDenomination(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;

  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase().replace(/_/g, " ");

  // Check underscore map first (exact match on raw)
  const underscoreKey = trimmed.toLowerCase().replace(/\s+/g, "_");
  if (UNDERSCORE_MAP[underscoreKey]) return UNDERSCORE_MAP[underscoreKey];

  // Check taxonomy match terms
  for (const cat of DENOMINATIONS) {
    if (cat.match.some((m) => lower.includes(m))) {
      return cat.canonical;
    }
  }

  // No match - return cleaned-up version (title case, no underscores)
  return lower
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Classify a church by its denomination_network value.
 * "Hillsong Church" → "Charismatic"
 * "Assemblies of God" → "Pentecostal"
 * Returns canonical denomination or null if no match.
 */
export function classifyByNetwork(network: string | null | undefined): string | null {
  if (!network || !network.trim()) return null;

  const lower = network.trim().toLowerCase();

  for (const cat of DENOMINATIONS) {
    if (!cat.networks) continue;
    if (cat.networks.some((n) => lower === n.toLowerCase() || lower.includes(n.toLowerCase()))) {
      return cat.canonical;
    }
  }

  // Also try the match terms (network name might contain a denomination keyword)
  for (const cat of DENOMINATIONS) {
    if (cat.match.some((m) => lower.includes(m))) {
      return cat.canonical;
    }
  }

  return null;
}

/**
 * Valid canonical denomination values for LLM prompts.
 */
export const CANONICAL_DENOMINATIONS = DENOMINATIONS.map((d) => d.canonical);
