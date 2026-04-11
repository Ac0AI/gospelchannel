import type { ChurchEnrichment, EnrichmentMatch } from '@/types/gospel';

type AddressValue = { street: string; city: string; postal_code?: string; country: string };

function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function normalizeString(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

const FIELD_TO_ENRICHMENT: Record<string, keyof ChurchEnrichment> = {
  phone: 'phone',
  contact_email: 'contactEmail',
  website_url: 'websiteUrl',
  denomination: 'denominationNetwork',
};

export function autoVerifyField(
  fieldName: string,
  value: unknown,
  enrichment: ChurchEnrichment | Partial<ChurchEnrichment> | null,
): EnrichmentMatch {
  // Logo always goes to admin
  if (fieldName === 'logo_url' || fieldName === 'cover_image_url') return 'no_data';

  if (!enrichment) return 'no_data';

  // Address: special comparison
  if (fieldName === 'address') {
    const enrichAddr = enrichment.streetAddress;
    if (!enrichAddr) return 'no_data';
    const addr = value as AddressValue;
    const enrichNorm = normalizeString(enrichAddr);
    const cityNorm = normalizeString(addr.city);
    if (enrichNorm.includes(cityNorm)) return 'matched';
    return 'mismatch';
  }

  // Website: domain comparison
  if (fieldName === 'website_url') {
    const enrichUrl = enrichment.websiteUrl;
    if (!enrichUrl) return 'no_data';
    return extractDomain(value as string) === extractDomain(enrichUrl) ? 'matched' : 'mismatch';
  }

  // Denomination: fuzzy (check if one contains the other)
  if (fieldName === 'denomination') {
    const enrichDenom = enrichment.denominationNetwork;
    if (!enrichDenom) return 'no_data';
    const valNorm = normalizeString(value as string);
    const enrichNorm = normalizeString(enrichDenom);
    if (enrichNorm.includes(valNorm) || valNorm.includes(enrichNorm)) return 'matched';
    return 'mismatch';
  }

  // Simple fields: exact match
  const enrichKey = FIELD_TO_ENRICHMENT[fieldName];
  if (!enrichKey) return 'no_data';

  const enrichValue = enrichment[enrichKey];
  if (!enrichValue) return 'no_data';

  // Case-insensitive string comparison
  const valStr = normalizeString(String(value));
  const enrichStr = normalizeString(String(enrichValue));
  return valStr === enrichStr ? 'matched' : 'mismatch';
}
