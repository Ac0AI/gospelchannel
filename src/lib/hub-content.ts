// Data-driven editorial + FAQ for facet hub pages. Pure and deterministic: the
// copy is woven from real per-hub facts (church count, top denominations and
// worship styles actually present in the city) so every hub reads differently
// and gives Google + AI answer engines genuine, unique content instead of a
// bare listing. No AI generation, so nothing to hallucinate or moderate.

export type HubFaq = { question: string; answer: string };
export type HubEditorial = { intro: string[]; faqs: HubFaq[] };

type FacetCount = { label: string; count?: number };

// Minimum churches for a hub to earn the full editorial treatment. Below this
// there is not enough substance to say anything specific, so thin city hubs
// stay clean rather than carrying near-identical boilerplate (which would read
// as doorway pages to Google).
export const HUB_EDITORIAL_MIN_CHURCHES = 8;

function naturalList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function buildCityHubContent(input: {
  city: string;
  country?: string | null;
  totalCount: number;
  denominations: FacetCount[];
  styles: FacetCount[];
  hasLocalFinder?: boolean;
}): HubEditorial | null {
  const { city, totalCount } = input;
  if (totalCount < HUB_EDITORIAL_MIN_CHURCHES) return null;

  const country = input.country?.trim() || null;
  const place = country ? `${city}, ${country}` : city;
  const count = totalCount.toLocaleString("en-US");

  const topDenoms = input.denominations.filter((d) => d.label).slice(0, 3).map((d) => d.label);
  const topStyles = input.styles.filter((s) => s.label).slice(0, 4).map((s) => s.label);

  const intro: string[] = [];
  intro.push(
    topDenoms.length > 0
      ? `${place} has ${count} churches listed on GospelChannel, spanning ${naturalList(topDenoms)}, among other traditions. Every listing gathers what matters when you are choosing where to worship: where a church meets, when its services are, and the music its people actually sing.`
      : `${place} has ${count} churches listed on GospelChannel. Every listing gathers what matters when you are choosing where to worship: where a church meets, when its services are, and the music its people actually sing.`,
  );
  intro.push(
    topStyles.length > 0
      ? `Worship is at the heart of how we list churches. Where a congregation in ${city} shares its music, often ${naturalList(topStyles.slice(0, 3))}, you will find Spotify playlists, live worship videos and the songs sung on Sunday, so you can hear a church before you ever visit. Use the worship-style and denomination links below to find a fit.`
      : `Worship is at the heart of how we list churches. Where a congregation in ${city} shares its music, you will find Spotify playlists, live worship videos and the songs sung on Sunday, so you can hear a church before you ever visit. Use the denomination links below to find a fit.`,
  );
  if (input.hasLocalFinder) {
    intro.push(
      `Use the ${city} Sunday finder below to start from your current location or a local area, choose a realistic radius, and narrow the list by worship, tradition, language, service time, and family needs. Distance is calculated in your browser; GospelChannel does not rank churches by theology, popularity, reviews, or paid placement.`,
    );
  }

  const faqs: HubFaq[] = [];
  if (input.hasLocalFinder) {
    faqs.push({
      question: `What is the best church in ${city} for me?`,
      answer: `There is no single best church for everyone in ${city}. A useful first match is close enough to attend and fits the service time, worship style, language, tradition, and family details that matter to your Sunday. GospelChannel explains those matches instead of publishing a universal ranking.`,
    });
    faqs.push({
      question: `How does the ${city} church finder use my location?`,
      answer: `Your browser calculates distance to churches with recorded map coordinates. Your precise coordinates stay in the browser and are not sent with the search or included in analytics. You can choose a local area instead of sharing your current location.`,
    });
  }
  faqs.push({
    question: `How many churches are there in ${city}?`,
    answer:
      topDenoms.length > 0
        ? `GospelChannel lists ${count} churches in ${place}, including ${naturalList(topDenoms)} congregations among others.`
        : `GospelChannel lists ${count} churches in ${place}.`,
  });
  if (input.denominations.filter((d) => d.label).length > 0) {
    const withCounts = input.denominations
      .filter((d) => d.label)
      .slice(0, 5)
      .map((d) =>
        typeof d.count === "number" ? `${d.label} (${d.count.toLocaleString("en-US")})` : d.label,
      );
    faqs.push({
      question: `What denominations are represented in ${city}?`,
      answer: `Churches in ${city} cover a range of traditions, including ${naturalList(withCounts)}.`,
    });
  }
  if (topStyles.length > 0) {
    faqs.push({
      question: `Can I find a church in ${city} by worship style?`,
      answer: `Yes. Churches in ${city} are tagged by worship style, including ${naturalList(topStyles)}. Many also share Spotify playlists and live worship videos, so you can hear how a congregation worships before visiting.`,
    });
  }
  faqs.push({
    question: `How do I choose a church in ${city}?`,
    answer: `Start with what matters most to you, whether that is denomination, worship style, language or simply location, then open each church's page for service times, music and community details. Our guide to finding the right church walks through it step by step.`,
  });

  return { intro, faqs };
}
