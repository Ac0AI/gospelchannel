/**
 * Extract structured church data from raw content using Claude.
 * Uses Haiku for structured extraction (fast, cheap).
 * Uses Sonnet for SEO description generation (higher quality).
 */
import Anthropic from "@anthropic-ai/sdk";

const EXTRACTION_MODEL = "claude-haiku-4-5-20251001";
const CONTENT_MODEL = "claude-sonnet-4-20250514";

/**
 * Strip markdown fences from LLM output before JSON parsing.
 */
function cleanJsonResponse(text) {
  return text
    .replace(/^```(?:json)?\n?/m, "")
    .replace(/\n?```$/m, "")
    .trim();
}

/**
 * Extract structured church data from crawled content.
 */
export async function extractChurchData({ googleData, websiteMarkdown, church }, anthropicKey) {
  const client = new Anthropic({ apiKey: anthropicKey });

  const contextParts = [];
  if (googleData) {
    contextParts.push(`## Google Places Data\n${JSON.stringify(googleData, null, 2)}`);
  }
  if (websiteMarkdown) {
    const truncated = websiteMarkdown.slice(0, 30000);
    contextParts.push(`## Church Website Content\n${truncated}`);
  }

  if (contextParts.length === 0) {
    console.log(`  [llm] No content to extract from`);
    return null;
  }

  const context = contextParts.join("\n\n---\n\n");
  console.log(`  [llm] Extracting structured data (${context.length} chars context)`);

  try {
    const response = await client.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `You are extracting structured data about a church/worship ministry called "${church.name}" located in "${church.location || church.country || 'unknown'}".
${church.denomination ? `Known denomination hint: ${church.denomination}` : ""}

IMPORTANT: Many entries in our database are worship music labels/bands tied to a parent church. For example "Bethel Music" belongs to "Bethel Church", "Hillsong Worship" to "Hillsong Church". Always try to identify the parent church.

Given the following data sources, extract these fields as JSON. Be thorough — look for clues in footer text, "about us" sections, contact pages, and meta descriptions. Use null ONLY if you truly cannot determine the value.

Fields to extract:
- officialChurchName: The parent church's actual/official registered name. For worship labels, this is the church they belong to (e.g. "Bethel Church" for "Bethel Music", "Passion City Church" for "Passion"). Look for "a ministry of...", "part of...", church name in headers/footers/about pages. null ONLY if the entity is clearly an independent band with no church affiliation.
- theologicalOrientation: Doctrinal stance. Use ONE of: "charismatic", "reformed", "evangelical", "pentecostal", "lutheran", "catholic", "orthodox", "anglican", "baptist", "methodist", "non-denominational", "progressive". Infer from worship style, statement of faith, language used (e.g. "spirit-filled" = charismatic). Can combine: "charismatic evangelical".
- denominationNetwork: Parent denomination, network, or movement. Examples: "Assemblies of God", "Hillsong Network", "Vineyard", "Church of Sweden", "Southern Baptist Convention", "Redeemed Christian Church of God", "Winners Chapel". Look for logos, affiliations, "we are part of..." text. null if clearly independent.
- languages: Array of languages used. Detect from: (1) explicit mentions, (2) website content language, (3) country context. A Swedish church likely uses ["Swedish"] even if website is in English.
- serviceTimes: Array of { day, time, label } objects. Look for: "Join us Sunday at 10am", footer times, "service times" pages. Times in local format. label can be "Morning Service", "Evening Service", etc.
- childrenMinistry: boolean — any mention of kids church, Sunday school, children's ministry?
- youthMinistry: boolean — any mention of youth group, young adults, teens ministry?
- ministries: Array of ministry/program names (e.g. ["worship team", "small groups", "prayer ministry", "missions", "marriage ministry"])
- churchSize: "small" (<200), "medium" (200-500), "large" (500-2000), "mega" (2000+). Clues: number of campuses, staff size, multiple service times, venue size, "thousands gather".
- instagramUrl: Full Instagram URL (e.g. "https://instagram.com/...")
- facebookUrl: Full Facebook URL
- youtubeUrl: Full YouTube channel URL
- contactEmail: General church email (not personal). Look in footer, contact page.
- phone: Phone number with country code if possible.

Respond with ONLY valid JSON, no markdown fences, no explanation.

${context}`,
        },
      ],
    });

    const text = response.content[0]?.text || "{}";
    return JSON.parse(cleanJsonResponse(text));
  } catch (err) {
    console.error(`  [llm] Extraction error: ${err.message}`);
    return null;
  }
}

/**
 * Generate SEO description and human-friendly summary.
 */
export async function generateChurchContent({ church, extractedData, websiteMarkdown }, anthropicKey) {
  const client = new Anthropic({ apiKey: anthropicKey });

  const context = [
    `Church: ${church.name}`,
    church.location ? `Location: ${church.location}` : null,
    church.denomination ? `Denomination: ${church.denomination}` : null,
    extractedData?.theologicalOrientation ? `Theology: ${extractedData.theologicalOrientation}` : null,
    extractedData?.languages ? `Languages: ${extractedData.languages.join(", ")}` : null,
    extractedData?.ministries ? `Ministries: ${extractedData.ministries.join(", ")}` : null,
    websiteMarkdown ? `\nWebsite excerpt:\n${websiteMarkdown.slice(0, 5000)}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  console.log(`  [llm] Generating SEO content`);

  try {
    const response = await client.messages.create({
      model: CONTENT_MODEL,
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `Write two pieces of content for a church profile page.

1. seoDescription: Exactly 150-160 characters. Optimized for Google search AND AI search engines (ChatGPT, Perplexity). Include the church name, location, and one distinctive feature.

2. summary: 2-3 sentences. Written for someone considering visiting this church. Warm but factual. Mention what makes this church unique — worship style, community, theology, or programs. Do NOT use generic phrases like "welcoming community" unless backed by specific evidence.

Respond with ONLY valid JSON: { "seoDescription": "...", "summary": "..." }

${context}`,
        },
      ],
    });

    const text = response.content[0]?.text || "{}";
    return JSON.parse(cleanJsonResponse(text));
  } catch (err) {
    console.error(`  [llm] Content generation error: ${err.message}`);
    return null;
  }
}
