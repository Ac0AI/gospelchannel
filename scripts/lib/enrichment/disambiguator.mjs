/**
 * Church disambiguation — matches churches across data sources.
 * Key rule: NEVER match on name alone; always require location context.
 */

/**
 * Build a search query for Google Places that includes name + location.
 * @param {string} name - Church name
 * @param {string} location - Location string, e.g. "Stockholm, Sweden"
 * @returns {string} Search query
 */
export function buildSearchQuery(name, location) {
  const city = location ? location.split(",")[0].trim() : "";

  // If name doesn't already contain "church"/"kyrka"/"igreja" etc., add "church"
  // to improve Google Places matching (many entries are worship labels, not church names)
  const churchTerms = /church|kyrka|igreja|iglesia|kirche|kerk|chapelle|chapel|temple|cathedral|parish|församling/i;
  const needsChurchHint = !churchTerms.test(name);

  const parts = [name];
  if (needsChurchHint) parts.push("church");
  if (city) parts.push(city);

  return parts.join(" ");
}

/**
 * Validate a Google Places result against our known church data.
 * @param {object} googleResult - Google Places result
 * @param {object} church - Our church data { name, location, website }
 * @returns {{ match: boolean, confidence: number, reason: string }}
 */
export function validateGoogleMatch(googleResult, church) {
  if (!googleResult)
    return { match: false, confidence: 0, reason: "no result" };

  const resultUrl = (googleResult.website || "")
    .toLowerCase()
    .replace(/\/+$/, "");
  const churchUrl = (church.website || "")
    .toLowerCase()
    .replace(/\/+$/, "");

  // Website URL match is strongest signal
  if (
    resultUrl &&
    churchUrl &&
    normalizeHost(resultUrl) === normalizeHost(churchUrl)
  ) {
    return { match: true, confidence: 0.95, reason: "website match" };
  }

  // Check if location/city appears in the Google result address
  const resultAddress = (googleResult.address || "").toLowerCase();
  const churchCity = (church.location || "")
    .split(",")[0]
    .trim()
    .toLowerCase();

  if (churchCity && resultAddress.includes(churchCity)) {
    return { match: true, confidence: 0.7, reason: "city match" };
  }

  // Name match but no location confirmation — low confidence
  return {
    match: false,
    confidence: 0.2,
    reason: "name only, no location confirmation",
  };
}

/**
 * Find if a candidate church already exists as a published church.
 * @param {object} candidate - { name, country, website }
 * @param {Array} publishedChurches - Array of ChurchConfig objects
 * @returns {object|null} Matching published church or null
 */
export function findPublishedDuplicate(candidate, publishedChurches) {
  const candName = (candidate.name || "").toLowerCase().trim();
  const candHost = normalizeHost(candidate.website || "");

  for (const church of publishedChurches) {
    // Website match is definitive
    const pubHost = normalizeHost(church.website || "");
    if (candHost && pubHost && candHost === pubHost) {
      return church;
    }

    // Name + country match
    const pubName = (church.name || "").toLowerCase().trim();
    const candCountry = (candidate.country || "").toLowerCase().trim();
    const pubCountry = (church.country || "").toLowerCase().trim();

    if (pubName === candName && candCountry && pubCountry === candCountry) {
      return church;
    }
  }

  return null;
}

function normalizeHost(url) {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(
      /^www\./,
      ""
    );
  } catch {
    return "";
  }
}
