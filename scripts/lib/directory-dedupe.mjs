import { normalizeHost } from "./church-intake-utils.mjs";

function normalizeLoc(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function buildHostLocationIndex(existingRows) {
  const byHost = new Map();
  for (const row of existingRows) {
    const host = normalizeHost(row.website || "");
    if (!host) continue;
    if (!byHost.has(host)) byHost.set(host, []);
    byHost.get(host).push({
      slug: row.slug,
      locKey: normalizeLoc(row.location),
      country: row.country || "",
    });
  }
  return byHost;
}

export function findHostLocationDuplicate(byHost, { website, country, location }) {
  const host = normalizeHost(website || "");
  if (!host) return null;
  const candidates = byHost.get(host) || [];
  if (candidates.length === 0) return null;
  const locKey = normalizeLoc(location);
  const normalizedCountry = String(country || "").trim();
  for (const c of candidates) {
    if (c.country && normalizedCountry && c.country !== normalizedCountry) continue;
    if (!c.locKey || !locKey || c.locKey === locKey) {
      return { slug: c.slug };
    }
  }
  return null;
}

export function addHostLocationEntry(byHost, { website, slug, location, country }) {
  const host = normalizeHost(website || "");
  if (!host) return;
  if (!byHost.has(host)) byHost.set(host, []);
  byHost.get(host).push({
    slug,
    locKey: normalizeLoc(location),
    country: country || "",
  });
}
