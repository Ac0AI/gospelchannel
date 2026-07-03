type MapsHrefInput = {
  googleMapsUrl?: string;
  name?: string;
  streetAddress?: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
};

// Build an outbound Google Maps link for a church. Preference order:
// 1. The Google Maps URL captured from Places (exact business card).
// 2. A name + address search — Google resolves this to the entity card with
//    reviews, not just an address pin. Requires at least a street address or
//    city so a bare name can't open the wrong church.
// 3. Raw coordinates as a last resort.
export function buildGoogleMapsHref(input: MapsHrefInput): string | undefined {
  if (input.googleMapsUrl) return input.googleMapsUrl;
  if (input.streetAddress || input.city) {
    const query = [input.name, input.streetAddress, input.city, input.country].filter(Boolean).join(", ");
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }
  if (input.latitude != null && input.longitude != null) {
    return `https://www.google.com/maps/search/?api=1&query=${input.latitude},${input.longitude}`;
  }
  return undefined;
}
