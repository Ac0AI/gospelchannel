/**
 * Auto-enrichment for new church suggestions.
 * Uses Claude Haiku to extract structured data from church websites.
 * Runs as a background task (via waitUntil) after a suggestion is saved.
 */

const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const FETCH_TIMEOUT = 10_000;

type EnrichmentResult = {
  city: string | null;
  description: string | null;
  heroImageUrl: string | null;
  contactEmail: string | null;
  serviceTimes: string | null;
  denomination: string | null;
  languages: string[] | null;
  quality: "good" | "mediocre" | "reject";
  qualityReason: string;
  nameFix: string | null;
};

async function fetchPageHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0; +https://gospelchannel.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, 50_000);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function callHaiku(system: string, user: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: HAIKU_MODEL,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Haiku API error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text || "";
}

/**
 * Enrich a church suggestion by fetching its website and analyzing with Haiku.
 * Returns structured enrichment data or null if the website is unreachable.
 */
export async function enrichFromWebsite(opts: {
  name: string;
  website: string;
  country?: string | null;
  city?: string | null;
  denomination?: string | null;
}): Promise<EnrichmentResult | null> {
  const { name, website, country, city, denomination } = opts;

  if (!website) return null;

  const html = await fetchPageHtml(website);
  if (!html) return null;

  const systemPrompt = `You are a data quality analyst for GospelChannel.com, a church directory.
Analyze church website HTML and extract structured data.
Respond ONLY with valid JSON, no markdown fences.`;

  const userPrompt = `Church: ${name}
Country: ${country || "unknown"}
City: ${city || "unknown"}
Denomination hint: ${denomination || "unknown"}
Website: ${website}

HTML:
${html.slice(0, 30_000)}

Extract JSON:
{
  "city": "City/town from website content. null if not found.",
  "description": "1-2 sentence description from their website. Focus on denomination, what makes them unique, community they serve. Max 200 chars. Natural language, no hashtags.",
  "hero_image_url": "Best hero/banner image URL from HTML (og:image, large hero images, header backgrounds). Full URL. null if none.",
  "contact_email": "Contact email from site. null if none.",
  "service_times": "Brief service times if found, e.g. 'Sundays 10:30am'. null if not found.",
  "denomination": "Use EXACTLY one of: Pentecostal, Charismatic, Evangelical, Baptist, Non-denominational, Anglican, Lutheran, Catholic, Methodist, Reformed, Orthodox. Pick the closest match. null if truly unclear.",
  "languages": ["Array of languages used in services"],
  "quality": "good | mediocre | reject",
  "quality_reason": "Brief reason. reject = unrelated to church, church closed, or site broken.",
  "name_fix": "Corrected name if HTML entities or formatting issues. Otherwise null."
}`;

  const raw = await callHaiku(systemPrompt, userPrompt);

  try {
    const cleaned = raw.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      city: parsed.city || null,
      description: parsed.description || null,
      heroImageUrl: parsed.hero_image_url || null,
      contactEmail: parsed.contact_email || null,
      serviceTimes: parsed.service_times || null,
      denomination: parsed.denomination || null,
      languages: Array.isArray(parsed.languages) ? parsed.languages : null,
      quality: parsed.quality || "mediocre",
      qualityReason: parsed.quality_reason || "",
      nameFix: parsed.name_fix || null,
    };
  } catch {
    console.error(`[auto-enrich] Failed to parse Haiku response for "${name}"`);
    return null;
  }
}

/**
 * Save enrichment results back to the church_suggestions table.
 */
export async function saveEnrichmentToSuggestion(
  suggestionId: string,
  enrichment: EnrichmentResult,
): Promise<void> {
  // We store enrichment data as a JSON column on the suggestion
  // so the admin panel can display it during review
  const { createAdminClient } = await import("@/lib/neon-client");
  const supabase = createAdminClient();

  await supabase
    .from("church_suggestions")
    .update({
      enrichment_data: {
        city: enrichment.city,
        description: enrichment.description,
        heroImageUrl: enrichment.heroImageUrl,
        contactEmail: enrichment.contactEmail,
        serviceTimes: enrichment.serviceTimes,
        denomination: enrichment.denomination,
        languages: enrichment.languages,
        quality: enrichment.quality,
        qualityReason: enrichment.qualityReason,
        nameFix: enrichment.nameFix,
        enrichedAt: new Date().toISOString(),
      },
    })
    .eq("id", suggestionId);
}
