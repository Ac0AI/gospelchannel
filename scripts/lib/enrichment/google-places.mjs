/**
 * Fetch church data from Google Places via Apify's Google Maps Scraper.
 * Actor: compass/crawler-google-places
 */
import { ApifyClient } from "apify-client";
import { buildSearchQuery, validateGoogleMatch } from "./disambiguator.mjs";

/**
 * @param {object} church - { name, location, website, country }
 * @param {string} apifyToken - Apify API token
 * @returns {Promise<{ data: object|null, raw: object|null, confidence: number }>}
 */
export async function fetchGooglePlaces(church, apifyToken) {
  const client = new ApifyClient({ token: apifyToken });
  const searchQuery = buildSearchQuery(church.name, church.location || church.country);
  console.log(`  [google] Searching: "${searchQuery}"`);

  try {
    const run = await client.actor("compass/crawler-google-places").call({
      searchStringsArray: [searchQuery],
      maxCrawledPlacesPerSearch: 3,
      language: "en",
      scrapeReviewerName: false,
      scrapeReviewId: false,
      scrapeReviewUrl: false,
      scrapeResponseFromOwner: false,
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    if (!items || items.length === 0) {
      console.log(`  [google] No results found`);
      return { data: null, raw: null, confidence: 0.1 };
    }

    // Find best match
    for (const item of items) {
      const validation = validateGoogleMatch(item, church);
      if (validation.match) {
        console.log(`  [google] Match: ${validation.reason} (confidence: ${validation.confidence})`);
        return {
          data: {
            streetAddress: item.address || null,
            googleMapsUrl: item.url || null,
            latitude: item.location?.lat || null,
            longitude: item.location?.lng || null,
            phone: item.phone || null,
            serviceTimes: parseGoogleHours(item.openingHours),
            categories: item.categories || [],
          },
          raw: item,
          confidence: validation.confidence,
        };
      }
    }

    console.log(`  [google] Results found but no confident match`);
    return { data: null, raw: items[0], confidence: 0.2 };
  } catch (err) {
    console.error(`  [google] Error: ${err.message}`);
    return { data: null, raw: null, confidence: 0 };
  }
}

function parseGoogleHours(openingHours) {
  if (!openingHours || !Array.isArray(openingHours)) return null;
  const times = [];
  for (const entry of openingHours) {
    const match = (entry.day || entry).toString().match(/^(\w+):\s*(.+)/);
    if (match) {
      const day = match[1];
      const timeStr = match[2].trim();
      if (timeStr.toLowerCase() !== "closed") {
        times.push({ day, time: timeStr });
      }
    }
  }
  return times.length > 0 ? times : null;
}
