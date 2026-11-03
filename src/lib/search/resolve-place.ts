// Finds the city or country in what is left of a search after the concepts
// ("stokholm", "gothenburg", "new york", "sverige"), tolerating typos and the
// common English, Swedish and local names for the same city. The directory
// lookup is injected so the matching can be tested without a database.

import { editDistance, foldText, isTypoOf } from "./text";

export type PlaceCandidate = { citySlug: string; label: string; country: string | null; churchCount: number };
export type CountryCandidate = { country: string; churchCount: number };

export type PlaceLookup = {
  /** Cities whose slug starts with this letter, most churches first. */
  citiesByInitial(initial: string): Promise<PlaceCandidate[]>;
  countries(): Promise<CountryCandidate[]>;
};

export type ResolvedPlace = {
  city?: PlaceCandidate;
  /** Every directory slug for the same city when it is stored under several names ("gothenburg" and "g-teborg"). */
  citySlugs?: string[];
  country?: string;
  /** Query words that were not part of the place: name search terms. */
  nameTerms: string[];
  /** Positions of nameTerms in the input words, to map back to the typed spelling. */
  nameTermIndexes: number[];
  corrections: Array<{ from: string; to: string }>;
};

// Folded alternative names → the names directory locations usually carry.
const CITY_ALIASES: Record<string, string[]> = {
  gothenburg: ["goteborg"],
  goteborg: ["gothenburg"],
  copenhagen: ["kobenhavn"],
  kopenhamn: ["kobenhavn", "copenhagen"],
  kobenhavn: ["copenhagen"],
  helsingfors: ["helsinki"],
  abo: ["turku"],
  munich: ["munchen"],
  munchen: ["munich"],
  cologne: ["koln"],
  koln: ["cologne"],
  vienna: ["wien"],
  wien: ["vienna"],
  prague: ["praha"],
  prag: ["praha", "prague"],
  warsaw: ["warszawa"],
  lisbon: ["lisboa"],
  lissabon: ["lisboa", "lisbon"],
  rome: ["roma"],
  rom: ["roma", "rome"],
  milan: ["milano"],
  florence: ["firenze"],
  naples: ["napoli"],
  athens: ["athina"],
  aten: ["athens", "athina"],
  brussels: ["bruxelles", "brussel"],
  bryssel: ["brussels", "bruxelles"],
  "the hague": ["den haag"],
  haag: ["den haag"],
  geneva: ["geneve"],
  zurich: ["zuerich"],
  moscow: ["moskva"],
  kiev: ["kyiv"],
  "new york city": ["new york"],
  nyc: ["new york"],
  la: ["los angeles"],
};

const COUNTRY_ALIASES: Record<string, string> = {
  sverige: "Sweden", norge: "Norway", danmark: "Denmark", suomi: "Finland", tyskland: "Germany",
  deutschland: "Germany", frankrike: "France", spanien: "Spain", espana: "Spain", italien: "Italy",
  italia: "Italy", nederlanderna: "Netherlands", holland: "Netherlands", nederland: "Netherlands",
  england: "United Kingdom", storbritannien: "United Kingdom", skottland: "United Kingdom", scotland: "United Kingdom",
  wales: "United Kingdom", uk: "United Kingdom", "great britain": "United Kingdom", usa: "United States",
  us: "United States", amerika: "United States", america: "United States", kanada: "Canada", brasilien: "Brazil",
  sydafrika: "South Africa", schweiz: "Switzerland", osterrike: "Austria", polen: "Poland", grekland: "Greece",
  ryssland: "Russia", ukraina: "Ukraine", island: "Iceland", irland: "Ireland", portugal: "Portugal",
  belgien: "Belgium", australien: "Australia", nyazeeland: "New Zealand", "nya zeeland": "New Zealand",
  mexiko: "Mexico", indien: "India", kina: "China", japan: "Japan", sydkorea: "South Korea", korea: "South Korea",
};

/** "London." or "Stockholm, Sweden" as a heading shows it: "London", "Stockholm". */
export function displayCity(label: string): string {
  return (label.split(",")[0] ?? label).trim().replace(/[\s.;:]+$/, "") || label.trim();
}

function cityName(label: string): string {
  // Same convention as extractCity in church-directory.ts: the part before the first comma, folded.
  return foldText(label.split(",")[0]?.trim() || label);
}

type Phrase = { text: string; start: number; length: number };

function phrases(words: string[], hintIndex: number): Phrase[] {
  const out: Phrase[] = [];
  const push = (start: number, length: number) => {
    if (start < 0 || start + length > words.length) return;
    out.push({ text: words.slice(start, start + length).join(" "), start, length });
  };
  // The word after "in"/"i"/"near" first, then the longest phrases, then single words from the end.
  if (hintIndex >= 0) for (let length = 3; length >= 1; length -= 1) push(hintIndex, length);
  for (let length = Math.min(3, words.length); length >= 1; length -= 1) {
    for (let start = words.length - length; start >= 0; start -= 1) push(start, length);
  }
  return out;
}

async function findCity(
  phrase: string,
  lookup: PlaceLookup,
  cache: Map<string, Promise<PlaceCandidate[]>>,
  allowTypos: boolean,
): Promise<{ city: PlaceCandidate; exact: boolean; slugs: string[] } | null> {
  const names = [phrase, ...(CITY_ALIASES[phrase] ?? [])];
  let best: { city: PlaceCandidate; distance: number } | null = null;
  // Exact hits under any of the city's names: the data mixes "Gothenburg" and "Göteborg".
  const exactHits: Array<{ city: PlaceCandidate; viaPhrase: boolean }> = [];
  for (const name of names) {
    const initial = name[0];
    if (!initial) continue;
    if (!cache.has(initial)) cache.set(initial, lookup.citiesByInitial(initial));
    const candidates = await cache.get(initial)!;
    const compact = name.replace(/[\s-]+/g, "");
    for (const city of candidates) {
      const label = cityName(city.label);
      const slug = city.citySlug.replace(/-/g, "");
      if (label === name || slug === compact) {
        if (!exactHits.some((hit) => hit.city.citySlug === city.citySlug)) exactHits.push({ city, viaPhrase: name === phrase });
        continue;
      }
      if (allowTypos && (isTypoOf(name, label) || isTypoOf(compact, slug))) {
        const distance = Math.min(editDistance(name, label), editDistance(compact, slug));
        if (!best || distance < best.distance || (distance === best.distance && city.churchCount > best.city.churchCount)) {
          best = { city, distance };
        }
      }
    }
  }
  if (exactHits.length > 0) {
    const primary = [...exactHits].sort((a, b) => b.city.churchCount - a.city.churchCount)[0];
    return {
      city: primary.city,
      exact: exactHits.some((hit) => hit.viaPhrase),
      slugs: exactHits.map((hit) => hit.city.citySlug),
    };
  }
  return best ? { city: best.city, exact: false, slugs: [best.city.citySlug] } : null;
}

async function findCountry(
  phrase: string,
  lookup: PlaceLookup,
  allowTypos: boolean,
): Promise<{ country: string; exact: boolean } | null> {
  const alias = COUNTRY_ALIASES[phrase];
  const countries = await lookup.countries();
  const wanted = alias ? foldText(alias) : phrase;
  let best: { country: string; distance: number } | null = null;
  for (const { country } of countries) {
    const folded = foldText(country);
    if (folded === wanted) return { country, exact: true };
    if (allowTypos && isTypoOf(wanted, folded)) {
      const distance = editDistance(wanted, folded);
      if (!best || distance < best.distance) best = { country, distance };
    }
  }
  return best ? { country: best.country, exact: false } : null;
}

export async function resolvePlace(
  words: string[],
  placeHint: string | undefined,
  lookup: PlaceLookup,
  options: { hasConcepts?: boolean } = {},
): Promise<ResolvedPlace> {
  const result: ResolvedPlace = { nameTerms: [], nameTermIndexes: [], corrections: [] };
  const used = new Set<number>();
  const cache = new Map<string, Promise<PlaceCandidate[]>>();
  const hintIndex = placeHint ? words.indexOf(placeHint) : -1;

  for (const phrase of phrases(words, hintIndex)) {
    if (result.city && result.country) break;
    if (Array.from({ length: phrase.length }, (_, i) => phrase.start + i).some((index) => used.has(index))) continue;
    // Single short words are rarely places on their own ("la" is handled as an alias).
    if (phrase.length === 1 && phrase.text.length < 3 && !CITY_ALIASES[phrase.text] && !COUNTRY_ALIASES[phrase.text]) continue;

    // Typos only where a place is expected: after "in"/"i"/"near", at the end of the
    // query, or next to a church type. Elsewhere a name word ("grace", "hillsong")
    // must not turn into a similarly spelled small town.
    const allowTypos =
      phrase.start === hintIndex || phrase.start + phrase.length === words.length || Boolean(options.hasConcepts);
    let matched = false;
    if (!result.country) {
      const country = await findCountry(phrase.text, lookup, allowTypos);
      if (country) {
        result.country = country.country;
        if (!country.exact && !COUNTRY_ALIASES[phrase.text]) result.corrections.push({ from: phrase.text, to: country.country });
        matched = true;
      }
    }
    if (!matched && !result.city) {
      const city = await findCity(phrase.text, lookup, cache, allowTypos);
      if (city) {
        result.city = city.city;
        result.citySlugs = city.slugs;
        if (!city.exact) result.corrections.push({ from: phrase.text, to: displayCity(city.city.label) });
        matched = true;
      }
    }
    if (matched) for (let i = 0; i < phrase.length; i += 1) used.add(phrase.start + i);
  }

  // A city and a country that disagree: trust the city, it is more specific.
  if (result.city && result.country && result.city.country && foldText(result.city.country) !== foldText(result.country)) {
    result.country = undefined;
  }
  result.nameTermIndexes = words.flatMap((_, index) => (used.has(index) ? [] : [index]));
  result.nameTerms = result.nameTermIndexes.map((index) => words[index]);
  return result;
}
