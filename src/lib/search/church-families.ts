// Families are what people mean by "charismatic" or "evangelical": not one
// denomination string but a group of them, plus a worship-style signal. In the
// directory most charismatic churches are tagged "Pentecostal", not
// "Charismatic", and few carry the "charismatic worship" style, so a plain
// style or denomination filter misses most of them.

import { DENOMINATIONS } from "@/lib/denomination-taxonomy";

export type ChurchFamily = {
  slug: string;
  label: string;
  /** Contains-patterns matched against the church's denomination (lowercase). */
  denominationPatterns: string[];
  /** Contains-patterns matched against the church's music styles (lowercase). */
  stylePatterns: string[];
  /**
   * Contains-patterns that rule a church out, matched against its denomination
   * and its name. "Apostolic" is mostly Pentecostal in the data, but Armenian
   * and New Apostolic churches share the word and are other traditions.
   */
  excludePatterns: string[];
};

function denominationMatches(...slugs: string[]): string[] {
  return slugs.flatMap((slug) => DENOMINATIONS.find((d) => d.slug === slug)?.match ?? []);
}

const CHARISMATIC_NETWORKS = [
  "vineyard",
  "every nation",
  "hillsong",
  "foursquare",
  "elim",
  "apostolic",
  "newfrontiers",
  "new frontiers",
  "c3 church",
  "bethel",
  "awakening",
  "word of life",
  "livets ord",
];

const EVANGELICAL_NETWORKS = [
  ...CHARISMATIC_NETWORKS,
  "calvary chapel",
  "christian and missionary alliance",
  "alliance",
  "free church",
  "evangelical free",
  "church of christ",
  "brethren",
  "mennonite",
  "covenant",
  "equmenia",
  "missionskyrkan",
];

export const CHURCH_FAMILIES: ChurchFamily[] = [
  {
    slug: "charismatic",
    label: "Charismatic",
    denominationPatterns: [...denominationMatches("charismatic", "pentecostal"), ...CHARISMATIC_NETWORKS],
    stylePatterns: ["charismatic", "prophetic", "spontaneous worship", "prayer-fueled", "pentecostal"],
    excludePatterns: ["armenian", "orthodox", "coptic", "new apostolic"],
  },
  {
    slug: "evangelical",
    label: "Evangelical",
    denominationPatterns: [
      ...denominationMatches("evangelical", "non-denominational", "baptist", "pentecostal", "charismatic"),
      ...EVANGELICAL_NETWORKS,
    ],
    stylePatterns: ["charismatic", "contemporary worship", "pentecostal"],
    // "Armenian Evangelical Church" stays; the Armenian Apostolic churches do not.
    excludePatterns: ["armenian apostolic", "armenian church", "orthodox", "coptic", "new apostolic"],
  },
];

/** Charismatic churches are a subset of evangelical ones: the narrower family wins. */
const FAMILY_SPECIFICITY = ["charismatic", "evangelical"];

export function getChurchFamily(slug: string | undefined): ChurchFamily | undefined {
  return slug ? CHURCH_FAMILIES.find((family) => family.slug === slug) : undefined;
}

export function narrowestFamily(slugs: string[]): string | undefined {
  return FAMILY_SPECIFICITY.find((slug) => slugs.includes(slug));
}

export function matchesFamily(
  church: { name?: string | null; denomination?: string | null; musicStyle?: string[] | null },
  familySlug: string,
): boolean {
  const family = getChurchFamily(familySlug);
  if (!family) return true;
  const denomination = (church.denomination ?? "").toLowerCase();
  const name = (church.name ?? "").toLowerCase();
  const styles = (church.musicStyle ?? []).join(" ").toLowerCase();
  if (family.excludePatterns.some((pattern) => denomination.includes(pattern) || name.includes(pattern))) return false;
  return (
    family.denominationPatterns.some((pattern) => denomination.includes(pattern.toLowerCase())) ||
    family.stylePatterns.some((pattern) => styles.includes(pattern.toLowerCase()))
  );
}
