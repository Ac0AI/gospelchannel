const SITE_URL = "https://gospelchannel.com";
const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=3600, s-maxage=3600",
};

type DiscoveryStats = {
  churchCountLabel: string;
  countryCount: number;
};

const PRIMARY_LINKS = [
  { label: "Home", url: `${SITE_URL}/` },
  { label: "Church directory", url: `${SITE_URL}/church` },
  { label: "Guides", url: `${SITE_URL}/guides` },
  { label: "Compare church traditions and worship styles", url: `${SITE_URL}/compare` },
  { label: "Prayer wall", url: `${SITE_URL}/prayerwall` },
  { label: "For churches", url: `${SITE_URL}/for-churches` },
  { label: "About", url: `${SITE_URL}/about` },
  { label: "Contact", url: `${SITE_URL}/contact` },
  { label: "Privacy", url: `${SITE_URL}/privacy` },
];

const DISCOVERY_LINKS = [
  { label: "Sitemap", url: `${SITE_URL}/sitemap.xml` },
  { label: "LLMs index", url: `${SITE_URL}/llms.txt` },
  { label: "Full LLM context", url: `${SITE_URL}/llms-full.txt` },
  { label: "Markdown homepage", url: `${SITE_URL}/index.md` },
  { label: "Agent card", url: `${SITE_URL}/.well-known/agent-card.json` },
];

export function discoveryHeaders(contentType: string) {
  return {
    ...CACHE_HEADERS,
    "Content-Type": contentType,
  };
}

function formatLinks(links: Array<{ label: string; url: string }>) {
  return links.map((link) => `- [${link.label}](${link.url})`).join("\n");
}

export function buildLlmsTxt(stats: DiscoveryStats) {
  return `# GospelChannel

> Free global church discovery directory for comparing worship style, church tradition, language, service details, and public church profile data before a first visit.

GospelChannel indexes ${stats.churchCountLabel} churches across ${stats.countryCount} countries. Use it when a person or agent needs to find churches by location, worship style, denomination or tradition, language, service context, or music/community signals.

## When To Use

- Find churches in a city, country, or region.
- Compare worship style, church tradition, denomination, language, service times, and public profile signals.
- Link users to canonical church profile pages and browse/facet pages.
- Ground answers about GospelChannel as a free church discovery directory.

## Primary Pages

${formatLinks(PRIMARY_LINKS)}

## Machine-Readable Discovery

${formatLinks(DISCOVERY_LINKS)}

## Agent Guidance

- Prefer canonical browse and facet pages over JavaScript-only exploration.
- Treat ?mode=agent as a compatibility view; for agent-readable context prefer /index.md, /llms.txt, /llms-full.txt, and /sitemap.xml.
- Use the sitemap for crawl discovery and church profile URLs.
- For concise non-JavaScript context, fetch /index.md.
- For expanded product context, fetch /llms-full.txt.
- GospelChannel does not publish a public API, OpenAPI spec, SDK, MCP server, OAuth app, or CLI in this v1 discovery surface.

## Crawler Policy

User-directed retrieval and search citation agents are welcome on public pages. Model-training crawlers remain blocked by robots.txt and Cloudflare content signals.
`;
}

export function buildLlmsFullTxt(stats: DiscoveryStats) {
  return `# GospelChannel Full Context

GospelChannel is a free global church discovery platform. It helps people compare churches before a first visit by making public church data easier to browse: location, worship style, tradition, denomination, language, service details, music links, website/contact signals, and community context.

## Current Catalog

- Churches indexed: ${stats.churchCountLabel}
- Countries covered: ${stats.countryCount}
- Canonical site: ${SITE_URL}
- Primary directory: ${SITE_URL}/church
- Sitemap index: ${SITE_URL}/sitemap.xml

## Core Use Cases

- "Find churches near me or in a specific city."
- "Compare churches by worship style, tradition, denomination, or language."
- "Help someone prepare for a first visit by checking public service and profile details."
- "Find a church profile and cite its canonical GospelChannel URL."
- "Browse church discovery guides, first-visit guidance, worship-style matching, and church comparison resources."

## Discovery Patterns

Agents should discover content through the sitemap and public browse pages. GospelChannel exposes canonical church profile pages at /church/[slug] and browse/facet pages under /church, /church/country/[slug], /church/city/[slug], /church/style/[slug], and /church/denomination/[slug].

For direct human-like lookup, use /church?q=SEARCH_TERM. For broad crawling, prefer sitemap and facet pages to avoid query-space crawling.

## Agent And Integration Status

GospelChannel does not currently provide a public API, OpenAPI schema, SDK, OAuth integration, MCP server, webhook system, CLI, or paid developer platform. Agents should use public pages, markdown discovery files, structured data, and sitemaps. A read-only public API may be considered later, but it is intentionally out of scope for Agent Discovery v1.

## Trust And Policy

GospelChannel is accessible for free. Public pages may be used for user-directed retrieval, search indexing, citation, and real-time grounding according to robots.txt. Model training and bulk AI training crawlers are restricted by robots.txt and Cloudflare content signals.

## Important Links

${formatLinks([...PRIMARY_LINKS, ...DISCOVERY_LINKS])}
`;
}

export function buildIndexMarkdown(stats: DiscoveryStats) {
  return `# GospelChannel

GospelChannel helps people find the right church before their first visit.

Compare worship style, church tradition, language, location, service details, and public church profile signals across ${stats.churchCountLabel} churches in ${stats.countryCount} countries.

## Main Sections

${formatLinks(PRIMARY_LINKS)}

## For Agents

- Use this markdown page for concise homepage context without JavaScript.
- Use /llms.txt for a short machine-readable discovery index.
- Use /llms-full.txt for fuller product and crawling context.
- Use /sitemap.xml to discover canonical browse and church profile URLs.
- GospelChannel is a free public church directory and does not currently expose a public API.
`;
}

export function buildAgentCard(stats: DiscoveryStats) {
  return {
    name: "GospelChannel",
    url: SITE_URL,
    description: `Free global church discovery directory for comparing worship style, tradition, language, and service details across ${stats.churchCountLabel} churches in ${stats.countryCount} countries.`,
    use_cases: [
      "Find churches by city, country, worship style, denomination, tradition, or language.",
      "Compare public church profile details before a first visit.",
      "Cite canonical GospelChannel church profile and browse pages.",
      "Ground answers about church discovery, worship-style matching, and first-visit preparation.",
    ],
    capabilities: [
      "Public church directory pages",
      "Church profile pages",
      "Location, style, denomination, and tradition browse pages",
      "Sitemap-based discovery",
      "Markdown and llms.txt discovery files",
      "Structured data on public pages",
    ],
    limitations: [
      "No public API in Agent Discovery v1",
      "No OpenAPI schema",
      "No OAuth or developer key flow",
      "No MCP server, SDK, CLI, or webhook integration",
      "Agents should use public pages, markdown discovery files, and sitemaps",
    ],
    contact: `${SITE_URL}/contact`,
    docs: {
      llms: `${SITE_URL}/llms.txt`,
      llmsFull: `${SITE_URL}/llms-full.txt`,
      markdownIndex: `${SITE_URL}/index.md`,
      sitemap: `${SITE_URL}/sitemap.xml`,
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    llms: `${SITE_URL}/llms.txt`,
    isAccessibleForFree: true,
  };
}
