/**
 * Fetch church data from Facebook Pages via Apify's Facebook Pages Scraper.
 * Actor: apify/facebook-pages-scraper
 *
 * Returns: address, phone, email, business_hours, categories, instagram, intro, etc.
 */
import { ApifyClient } from "apify-client";

/**
 * @param {string} facebookUrl - Facebook page URL
 * @param {string} apifyToken - Apify API token
 * @returns {Promise<{ data: object|null, raw: object|null }>}
 */
export async function fetchFacebookPage(facebookUrl, apifyToken) {
  const client = new ApifyClient({ token: apifyToken });

  console.log(`  [facebook] Scraping: ${facebookUrl}`);

  try {
    const run = await client.actor("apify/facebook-pages-scraper").call({
      startUrls: [{ url: facebookUrl }],
      maxPagesPerQuery: 1,
    });

    const { items } = await client
      .dataset(run.defaultDatasetId)
      .listItems();

    if (!items || items.length === 0) {
      console.log(`  [facebook] No data returned`);
      return { data: null, raw: null };
    }

    const page = items[0];

    const data = {
      address: page.address || null,
      phone: page.phone || null,
      email: page.email || null,
      businessHours: parseBusinessHours(page.business_hours),
      categories: page.categories || [],
      instagramUrl: page.instagram || null,
      website: page.website || null,
      intro: page.intro || null,
      likes: page.likes || null,
      followers: page.followers || null,
    };

    const filledFields = Object.entries(data).filter(
      ([, v]) => v && (!Array.isArray(v) || v.length > 0)
    ).length;

    console.log(
      `  [facebook] Got ${filledFields} fields (address: ${!!data.address}, phone: ${!!data.phone}, email: ${!!data.email}, hours: ${!!data.businessHours})`
    );

    return { data, raw: page };
  } catch (err) {
    console.error(`  [facebook] Error: ${err.message}`);
    return { data: null, raw: null };
  }
}

/**
 * Parse Facebook business_hours into our service_times format.
 * Facebook returns: { mon: [{open: "09:00", close: "17:00"}], ... }
 * We want: [{ day: "Sunday", time: "10:00 - 12:00" }]
 */
function parseBusinessHours(hours) {
  if (!hours || typeof hours !== "object") return null;

  const dayMap = {
    mon: "Monday",
    tue: "Tuesday",
    wed: "Wednesday",
    thu: "Thursday",
    fri: "Friday",
    sat: "Saturday",
    sun: "Sunday",
  };

  const times = [];
  for (const [key, slots] of Object.entries(hours)) {
    const dayName = dayMap[key] || key;
    if (Array.isArray(slots)) {
      for (const slot of slots) {
        if (slot.open && slot.close) {
          times.push({ day: dayName, time: `${slot.open} - ${slot.close}` });
        }
      }
    }
  }

  return times.length > 0 ? times : null;
}
