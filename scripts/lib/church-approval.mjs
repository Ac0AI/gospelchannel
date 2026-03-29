import { isOfficialWebsiteUrl, normalizeName } from "./church-intake-utils.mjs";
import { isUsableHeroImageUrl, isValidOfficialEmail } from "./church-quality.mjs";
import { isLikelyChurchContactEmail } from "./website-contact.mjs";

/**
 * @typedef {{
 *   street_address?: string;
 *   website_url?: string;
 *   contact_email?: string;
 *   facebook_url?: string;
 *   cover_image_url?: string;
 *   confidence?: number;
 * }} ApprovalEnrichment
 *
 * @typedef {{
 *   verdict?: string;
 *   websiteChurchScore?: number;
 *   headerImageUrl?: string;
 *   location?: string;
 *   country?: string;
 * }} ApprovalScreening
 *
 * @typedef {{
 *   enrichment?: ApprovalEnrichment | null;
 *   screening?: ApprovalScreening | null;
 *   fetchedEmail?: string;
 *   approvalThreshold?: number;
 * }} ApprovalOptions
 */

const IDENTITY_KEYWORDS = [
  "church",
  "chapel",
  "cathedral",
  "parish",
  "abbey",
  "minster",
  "fellowship",
  "assembly",
  "salvation army",
  "central hall",
  "jesus centre",
  "christian centre",
  "gospel hall",
  "quaker",
  "christadelphian",
  "kyrka",
  "församling",
  "kirche",
  "gemeinde",
  "église",
  "eglise",
  "iglesia",
  "igreja",
  "seurakunta",
  "kirke",
];

const IDENTITY_PATTERNS = [
  /\bsaint\b/,
  /\bsaints\b/,
  /\bst\b/,
];

const GENERIC_NAME_PATTERNS = [
  /^home$/i,
  /^welcome$/i,
  /^calendar$/i,
  /^community$/i,
  /^church$/i,
  /^gemeinde$/i,
  /^församling$/i,
];

function hasIdentityKeyword(value = "") {
  const normalized = normalizeName(value);
  return (
    IDENTITY_KEYWORDS.some((keyword) => normalized.includes(normalizeName(keyword))) ||
    IDENTITY_PATTERNS.some((pattern) => pattern.test(normalized))
  );
}

function looksGenericName(value = "") {
  return GENERIC_NAME_PATTERNS.some((pattern) => pattern.test(String(value || "").trim()));
}

function looksLikeLocation(value = "") {
  const trimmed = String(value || "").trim();
  if (!trimmed) return false;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return false;
  if (/^https?:\/\//i.test(trimmed)) return false;
  return true;
}

/**
 * @param {{ slug?: string; website?: string; email?: string; location?: string; country?: string; header_image?: string; confidence?: number; name?: string; }} church
 * @param {ApprovalOptions} [options]
 */
export function mergeApprovalSignals(church, { enrichment = null, screening = null, fetchedEmail = "" } = {}) {
  const website = church.website || enrichment?.website_url || "";
  const websiteHost = (() => {
    try {
      return new URL(website).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      return "";
    }
  })();
  const emailCandidates = [church.email || "", enrichment?.contact_email || "", fetchedEmail || ""];
  const email = emailCandidates.find((value) => isValidOfficialEmail(value) && isLikelyChurchContactEmail(value, websiteHost)) || "";
  const locationCandidates = [church.location || "", enrichment?.street_address || "", screening?.location || ""];
  const location = locationCandidates.find((value) => looksLikeLocation(value)) || "";
  const headerImageCandidates = [
    church.header_image || "",
    enrichment?.cover_image_url || "",
    screening?.headerImageUrl || "",
  ];
  const headerImage = headerImageCandidates.find((value) => isUsableHeroImageUrl(value)) || "";

  return {
    website,
    email,
    location,
    country: church.country || screening?.country || "",
    facebookUrl: enrichment?.facebook_url || "",
    headerImage,
    verdict: screening?.verdict || "",
  };
}

/**
 * @param {{ slug?: string; website?: string; email?: string; location?: string; country?: string; header_image?: string; confidence?: number; name?: string; }} church
 * @param {ApprovalOptions} [options]
 */
export function buildApprovalDecision(
  church,
  { enrichment = null, screening = null, fetchedEmail = "", approvalThreshold = 70 } = {}
) {
  const merged = mergeApprovalSignals(church, { enrichment, screening, fetchedEmail });
  const verdict = merged.verdict;
  const hasStrongVerdict =
    verdict === "verified_church_with_playlist" ||
    verdict === "verified_church_needs_playlist";
  const hasIdentity = hasIdentityKeyword(church.name) && !looksGenericName(church.name);
  const hasOfficialWebsite = isOfficialWebsiteUrl(merged.website);
  const hasPlace = Boolean(merged.location);

  let score = 0;
  if (hasOfficialWebsite) score += 40;
  if (hasPlace) score += 20;
  if (hasStrongVerdict) score += 18;
  else if (hasIdentity) score += 12;
  if ((screening?.websiteChurchScore || 0) >= 0.72) score += 10;
  if ((church.confidence || 0) >= 0.7) score += 4;
  if ((enrichment?.confidence || 0) >= 0.7) score += 4;
  if (merged.email) score += 8;
  if (merged.facebookUrl) score += 6;

  const blockers = [];
  if (!hasOfficialWebsite) blockers.push("missing_official_website");
  if (!hasPlace) blockers.push("missing_place");
  if (!hasStrongVerdict && !hasIdentity) blockers.push("weak_identity_signal");
  if (verdict === "non_church") blockers.push("screened_as_non_church");

  const eligible = blockers.length === 0 && score >= approvalThreshold;
  const wave = merged.email && merged.facebookUrl && merged.headerImage ? 1 : 2;

  return {
    eligible,
    score,
    wave,
    blockers,
    merged,
  };
}
