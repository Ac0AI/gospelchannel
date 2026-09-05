export const OFFICIAL_REVIEW_FIELDS = {
  services: "Service times",
  address: "Visit address",
  languages: "Service languages",
  children: "Children",
  firstVisit: "Your first visit",
  accessibility: "Accessibility",
  tradition: "Tradition or network",
  worship: "Worship",
  youth: "Youth",
  safeguarding: "Safeguarding",
  transport: "Parking and transport",
  community: "Groups and pastoral care",
  contact: "Contact",
} as const;

export type OfficialReviewField = keyof typeof OFFICIAL_REVIEW_FIELDS;
export type OfficialReviewFact = { value: string; sourceUrl: string };
export type OfficialChurchReview = {
  checkedAt: string;
  facts: Partial<Record<OfficialReviewField, OfficialReviewFact>>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSourceUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Editorial checks live in Neon alongside, but do not confer, church ownership. */
export function parseOfficialChurchReview(sources: unknown): OfficialChurchReview | undefined {
  if (!isRecord(sources) || !isRecord(sources.official_review)) return undefined;
  const review = sources.official_review;
  if (typeof review.checkedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(review.checkedAt)) return undefined;
  const date = new Date(`${review.checkedAt}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== review.checkedAt) return undefined;
  if (!isRecord(review.facts)) return undefined;

  const facts: OfficialChurchReview["facts"] = {};
  for (const field of Object.keys(OFFICIAL_REVIEW_FIELDS) as OfficialReviewField[]) {
    const fact = review.facts[field];
    if (!isRecord(fact) || typeof fact.value !== "string" || !fact.value.trim() || !isSourceUrl(fact.sourceUrl)) continue;
    facts[field] = { value: fact.value.trim(), sourceUrl: fact.sourceUrl };
  }
  // A review needs the two essentials for visiting an identified campus.
  if (!facts.services || !facts.address) return undefined;
  return { checkedAt: review.checkedAt, facts };
}
