// Turns a free-text church search ("karismatiska evangelikala kyrkor i stokholm",
// "english speaking baptist church london") into directory filters. Pure and
// synchronous: place names are only collected here and resolved against the
// directory by resolve-place.ts.

import { narrowestFamily } from "./church-families";
import { foldText, isTypoOf, tokenize, tokenizeOriginal } from "./text";

type ConceptKind = "family" | "denomination" | "style" | "language" | "kids" | "serviceTimes";

type Concept = {
  kind: ConceptKind;
  value: string;
  /** Folded single words or phrases. Words of five letters or more also match inflected forms and typos. */
  terms: string[];
};

// Values are directory slugs (families, denominations, styles) or language labels.
const CONCEPTS: Concept[] = [
  {
    kind: "family",
    value: "charismatic",
    terms: [
      "charismatic", "charismatics", "karismatisk", "karismatiske", "karismatiskt", "charismatisch",
      "charismatique", "carismatico", "carismatica", "carismatica", "karismaattinen", "spirit-filled",
      "spirit filled", "andefylld", "full gospel",
    ],
  },
  {
    kind: "family",
    value: "evangelical",
    terms: [
      "evangelical", "evangelicals", "evangelikal", "evangelikalt", "evangelisk", "evangelico", "evangelica",
      "evangelique", "frikyrka", "frikyrkor", "frikyrklig", "frikirke", "freikirche", "free church",
      "born again", "bible believing", "bibeltrogen",
    ],
  },
  {
    kind: "denomination",
    value: "pentecostal",
    terms: [
      "pentecostal", "pentecostals", "pingst", "pingstkyrka", "pingstforsamling", "pingstvanner", "pinse",
      "pinsekirke", "pinsemenighet", "pfingst", "pfingstgemeinde", "pentecostales", "pentecotiste",
      "helluntai", "assemblies of god", "assembly of god",
    ],
  },
  { kind: "denomination", value: "baptist", terms: ["baptist", "baptister", "baptistkyrka", "baptistforsamling", "bautista", "baptiste", "baptisten", "battista"] },
  { kind: "denomination", value: "lutheran", terms: ["lutheran", "luthersk", "lutherisch", "lutherien", "luterano"] },
  { kind: "denomination", value: "catholic", terms: ["catholic", "katolsk", "katholisch", "catholique", "catolica", "catolico", "cattolica"] },
  { kind: "denomination", value: "anglican", terms: ["anglican", "anglikansk", "anglikanisch", "episcopal", "church of england"] },
  { kind: "denomination", value: "methodist", terms: ["methodist", "metodist", "methodistisch", "metodista", "wesleyan", "nazarene"] },
  { kind: "denomination", value: "reformed", terms: ["reformed", "reformert", "reformerta", "reformiert", "presbyterian", "presbyteriansk", "calvinist"] },
  { kind: "denomination", value: "orthodox", terms: ["orthodox", "ortodox", "ortodoxa", "orthodoxe"] },
  {
    kind: "denomination",
    value: "non-denominational",
    terms: [
      "non-denominational", "nondenominational", "non denominational", "interdenominational", "independent",
      "fristaende", "oberoende", "samfundslos", "konfessionslos",
    ],
  },
  { kind: "style", value: "contemporary-worship", terms: ["contemporary", "modern", "nutida", "samtida", "moderna", "zeitgemass", "contemporanea"] },
  { kind: "style", value: "gospel", terms: ["gospel", "gospelkor", "gospelchoir", "gospel choir"] },
  { kind: "style", value: "african", terms: ["african", "afrikansk", "afrikanisch", "africaine"] },
  { kind: "style", value: "latin", terms: ["latino", "latina", "latinamerikansk", "hispanic", "hispano"] },
  { kind: "language", value: "English", terms: ["english", "engelsk", "engelskspraakig", "engelskspraklig", "english-speaking", "english speaking", "englischsprachig", "anglophone"] },
  { kind: "language", value: "Spanish", terms: ["spanish", "spansk", "spanskspraklig", "espanol", "spanish-speaking", "hispanohablante"] },
  { kind: "language", value: "Swedish", terms: ["swedish", "svensk", "svenskspraklig", "swedish-speaking"] },
  { kind: "language", value: "German", terms: ["german", "tysk", "tyskspraklig", "deutsch", "deutschsprachig", "german-speaking"] },
  { kind: "language", value: "French", terms: ["french", "fransk", "franskspraklig", "francais", "francophone", "french-speaking"] },
  { kind: "language", value: "Portuguese", terms: ["portuguese", "portugisisk", "portugues", "brazilian", "brasiliansk"] },
  { kind: "language", value: "Korean", terms: ["korean", "koreansk", "koreanisch"] },
  { kind: "language", value: "Chinese", terms: ["chinese", "kinesisk", "mandarin", "cantonese", "kantonesisk"] },
  { kind: "language", value: "Finnish", terms: ["finnish", "finsk", "finskspraklig", "suomi", "suomenkielinen"] },
  { kind: "language", value: "Arabic", terms: ["arabic", "arabisk", "arabiska", "arabischsprachig"] },
  { kind: "language", value: "Persian", terms: ["persian", "persisk", "farsi"] },
  {
    kind: "kids",
    value: "true",
    terms: [
      "kids", "children", "childrens", "barn", "barnverksamhet", "sondagsskola", "family", "families",
      "family-friendly", "family friendly", "familj", "familjer", "familjevanlig", "kinder", "kindergottesdienst", "ninos",
    ],
  },
  { kind: "serviceTimes", value: "true", terms: ["service times", "gudstjanstider", "motestider", "gottesdienstzeiten"] },
];

// Words that carry no search meaning on their own in the languages people use here.
const STOPWORDS = new Set([
  // church words
  "church", "churches", "kyrka", "kyrkor", "kyrkan", "kyrkorna", "forsamling", "forsamlingar", "forsamlingen",
  "kirke", "kirker", "kirken", "kirkko", "seurakunta", "kirche", "kirchen", "gemeinde", "gemeinden", "iglesia",
  "iglesias", "igreja", "igrejas", "eglise", "eglises", "chiesa", "chiese", "kerk", "kerken", "congregation",
  "congregations", "ministry", "ministries", "worship", "lovsang",
  // prepositions, articles, glue
  "in", "i", "pa", "near", "nara", "around", "at", "kring", "runt", "omkring", "the", "a", "an", "en", "ett",
  "with", "med", "som", "for", "and", "och", "und", "y", "e", "et", "de", "der", "die", "das", "la", "le", "les",
  "los", "las", "el", "di", "del", "da", "do", "of", "to", "that", "who", "har", "has", "have", "is", "are", "ar",
  // request words
  "best", "basta", "good", "bra", "great", "find", "hitta", "search", "sok", "looking", "letar", "efter", "show",
  "visa", "me", "mig", "my", "min", "im", "jag", "want", "vill", "need", "behover", "any", "nagon", "nagra",
  "some", "list", "lista", "all", "alla", "christian", "kristen", "kristna", "speaking", "spraklig", "talande",
]);

export type QueryConceptMatch = { kind: ConceptKind; value: string; from: string; to: string };

export type UnderstoodQuery = {
  familySlug?: string;
  denominationSlug?: string;
  styleSlug?: string;
  language?: string;
  hasKids?: boolean;
  hasServiceTimes?: boolean;
  /** Words left after removing concepts and stopwords, in query order: candidates for a place or a name. */
  rest: string[];
  /** `rest` as typed, diacritics kept ("söderkyrkan"), for matching names in the database. */
  restOriginal: string[];
  /** The word right after "in", "i", "near" or "nära", if any: the strongest place hint. */
  placeHint?: string;
  matches: QueryConceptMatch[];
};

const PLACE_PREPOSITIONS = new Set(["in", "i", "near", "nara", "around", "kring", "runt", "omkring", "at"]);

// Inflected forms: "karismatiska", "pingstkyrkor", "evangelikala", "baptistkyrkan".
const SUFFIXES = ["arna", "erna", "orna", "ena", "na", "en", "et", "er", "ar", "or", "a", "e", "s", "n", "t"];

function stems(token: string): string[] {
  const out = [token];
  for (const suffix of SUFFIXES) {
    if (token.length - suffix.length >= 5 && token.endsWith(suffix)) out.push(token.slice(0, -suffix.length));
  }
  return out;
}

/** 3 = exact, 2 = inflected form or compound ("karismatiska", "pingstkyrkor"), 1 = typo, 0 = no match. */
function wordScore(token: string, term: string): number {
  if (token === term) return 3;
  if (term.length < 5 || token.length < 4) return 0;
  const tokenStems = stems(token);
  if (tokenStems.includes(term) || (token.length > term.length && token.startsWith(term))) return 2;
  return tokenStems.some((stem) => isTypoOf(stem, term)) ? 1 : 0;
}

type PhraseHit = { concept: Concept; term: string; length: number; score: number };

function findConceptAt(tokens: string[], index: number): PhraseHit | null {
  let best: PhraseHit | null = null;
  for (const concept of CONCEPTS) {
    for (const term of concept.terms) {
      const parts = term.split(" ");
      const window = tokens.slice(index, index + parts.length);
      if (window.length !== parts.length) continue;
      const scores = window.map((token, i) => wordScore(token, parts[i]));
      if (scores.some((score) => score === 0)) continue;
      const score = Math.min(...scores);
      const better =
        !best ||
        parts.length > best.length ||
        (parts.length === best.length && (score > best.score || (score === best.score && term.length > best.term.length)));
      if (better) best = { concept, term, length: parts.length, score };
    }
  }
  return best;
}

export function understandQuery(raw: string): UnderstoodQuery {
  const tokens = tokenize(raw);
  const originals = tokenizeOriginal(raw);
  const result: UnderstoodQuery = { rest: [], restOriginal: [], matches: [] };
  const families: string[] = [];
  let nextIsPlace = false;

  for (let index = 0; index < tokens.length; ) {
    const token = tokens[index];
    const hit = findConceptAt(tokens, index);
    if (hit) {
      const from = tokens.slice(index, index + hit.length).join(" ");
      result.matches.push({ kind: hit.concept.kind, value: hit.concept.value, from, to: hit.term });
      if (hit.concept.kind === "family") families.push(hit.concept.value);
      if (hit.concept.kind === "denomination") result.denominationSlug ??= hit.concept.value;
      if (hit.concept.kind === "style") result.styleSlug ??= hit.concept.value;
      if (hit.concept.kind === "language") result.language ??= hit.concept.value;
      if (hit.concept.kind === "kids") result.hasKids = true;
      if (hit.concept.kind === "serviceTimes") result.hasServiceTimes = true;
      index += hit.length;
      nextIsPlace = false;
      continue;
    }
    if (PLACE_PREPOSITIONS.has(token)) {
      nextIsPlace = true;
      index += 1;
      continue;
    }
    if (!STOPWORDS.has(token) && !/^\d{1,2}$/.test(token)) {
      if (nextIsPlace && !result.placeHint) result.placeHint = token;
      result.rest.push(token);
      result.restOriginal.push(originals[index] ?? token);
    }
    nextIsPlace = false;
    index += 1;
  }

  // A named denomination is narrower than a family ("evangelical baptist" means Baptist).
  if (!result.denominationSlug) result.familySlug = narrowestFamily(families);
  return result;
}

/** True when the query asked for something the directory can filter on. */
export function hasConcepts(query: UnderstoodQuery): boolean {
  return Boolean(
    query.familySlug || query.denominationSlug || query.styleSlug || query.language || query.hasKids || query.hasServiceTimes,
  );
}

export { foldText };
