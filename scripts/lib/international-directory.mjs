import {
  decodeHtml,
  isOfficialWebsiteUrl,
  normalizeWhitespace,
} from "./church-intake-utils.mjs";

function stripTags(value = "") {
  return normalizeWhitespace(
    decodeHtml(String(value).replace(/<br\s*\/?>/gi, ", ").replace(/<[^>]+>/g, " "))
  );
}

function extractHref(value = "") {
  const match = String(value).match(/href="([^"]+)"/i);
  return match ? decodeHtml(match[1]) : "";
}

export function parseCountryLinks(html = "") {
  const links = [];
  const matches = html.matchAll(/<a href="(https:\/\/www\.internationalchurches\.eu\/list\/wpbdp_category\/([^/"?#]+)\/)"[^>]*>([^<]+)<\/a>/gi);
  const seen = new Set();

  for (const match of matches) {
    const url = match[1];
    const slug = match[2];
    const name = stripTags(match[3]);
    const key = `${slug}|${name}`;
    if (!slug || !name || seen.has(key)) continue;
    seen.add(key);
    links.push({ slug, name, url });
  }

  return links;
}

function extractAddress(block = "") {
  const match = block.match(/<span class="field-label address-label">Address<\/span>\s*<div>([\s\S]*?)<\/div>/i);
  return match ? stripTags(match[1]) : "";
}

function extractThumbnailUrl(block = "") {
  const match = block.match(/<div class="listing-thumbnail">[\s\S]*?<img[^>]+src="([^"]+)"/i);
  if (!match) return "";
  const url = decodeHtml(match[1]);
  if (url.includes("default-image-big.gif")) return "";
  return url;
}

function extractFields(block = "") {
  const fields = {};
  const matches = block.matchAll(/<span class="field-label(?: [^"]*)?">([^<]+)<\/span>\s*<div class="value">([\s\S]*?)<\/div><\/div>/gi);
  for (const match of matches) {
    const label = stripTags(match[1]).toLowerCase();
    const htmlValue = match[2];
    fields[label] = {
      text: stripTags(htmlValue),
      href: extractHref(htmlValue),
    };
  }
  return fields;
}

export function parseDirectoryListings(html = "") {
  const listings = [];
  const blocks = html.matchAll(/<div id="wpbdp-listing-\d+"[\s\S]*?<\/div>\s*<div class="listing-actions/gi);

  for (const match of blocks) {
    const block = match[0];
    const fields = extractFields(block);
    const name = fields.name?.text || "";
    const country = fields.country?.text || "";
    const website = fields["website address"]?.href || fields.website?.href || "";

    listings.push({
      name,
      country,
      address: extractAddress(block),
      description: fields.description?.text || "",
      website,
      facebookUrl: fields["facebook page"]?.href || "",
      youtubeUrl: fields["youtube page"]?.href || fields["online church service"]?.href || "",
      phone: fields["phone number"]?.text || "",
      sundayMeetingTime: fields["sunday meeting time"]?.text || "",
      listingUrl: fields.name?.href || "",
      thumbnailUrl: extractThumbnailUrl(block),
    });
  }

  return listings.filter((listing) => listing.name && listing.country);
}

export function parseNextCategoryPage(html = "") {
  const match = html.match(/<span class="next">\s*<a href="([^"]+)"/i);
  return match ? decodeHtml(match[1]) : "";
}

export function inferLocationFromAddress(address = "", country = "") {
  const cleaned = stripTags(address);
  if (!cleaned) return "";

  const parts = cleaned
    .split(",")
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);

  const filtered = parts.filter((part) => part.toLowerCase() !== normalizeWhitespace(country).toLowerCase());
  for (let index = filtered.length - 1; index >= 0; index -= 1) {
    const candidate = filtered[index]
      .replace(/\b\d{3,}\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!candidate) continue;
    if (candidate.length < 2) continue;
    return candidate;
  }

  return "";
}

export function getOfficialDirectoryWebsite(listing) {
  return isOfficialWebsiteUrl(listing.website) ? listing.website : "";
}
