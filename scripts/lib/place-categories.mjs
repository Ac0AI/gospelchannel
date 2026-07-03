// Shared guard: decide whether a Google Places result actually belongs to a
// church, or whether its place_id resolved to a NON-church (wrong identity, or a
// non-Christian place of worship). Used by fetch-church-photos.mjs (skip photo
// mirroring) and backfill-places-data.mjs (skip contact/data backfill) so both
// stay in sync from one definition.

// Category tokens that mean "not our church". Matched case-insensitively against
// categories[] + categoryName. High-precision on purpose: a real church is
// categorised "Church"/"Pentecostal church"/etc., never "Restaurant" or "Mosque".
export const OFF_BRAND_CATEGORIES = [
  // non-Christian worship
  "mosque", "masjid", "synagogue", "gurudwara", "gurdwara", "mandir",
  "hindu temple", "buddhist temple", "sikh temple", "islamic center",
  // clearly secular / commercial → place_id mismatch
  "restaurant", "bistro", "seafood", "cafe", "coffee shop", "diner", "bar & grill",
  "dentist", "dental", "orthodont", "medical clinic", "health center", "health clinic",
  "mental health", "pharmacy", "hospital",
  "thrift store", "second hand", "used clothing", "vintage clothing",
  "nature preserve", "national preserve", "state park", "amusement park",
  "gas station", "hotel", "motel", "community center", "park",
];

// A churchy category present anywhere overrides the skip so we never drop a
// legitimate church that merely also carries a benign tag. "messianic" is
// on-brand (Messianic congregations believe in Jesus and are KEPT per brand
// policy) — it overrides the "synagogue" off-brand token.
export const CHURCHY_CATEGORY_RE =
  /\b(church|chapel|cathedral|christian|evangel|baptist|pentecost|methodist|presbyter|lutheran|ministr|gospel|congregation|parish|tabernacle|worship center|assembly of god|messianic)\b/;

// Returns { reason, categories } when the crawled place is clearly not a church,
// otherwise null.
export function offBrandCategory(item) {
  const cats = [...(item.categories || []), item.categoryName || ""].join(" | ").toLowerCase();
  if (CHURCHY_CATEGORY_RE.test(cats)) return null;
  const hit = OFF_BRAND_CATEGORIES.find((t) => cats.includes(t));
  return hit ? { reason: hit, categories: (item.categories || []).join(", ") } : null;
}
