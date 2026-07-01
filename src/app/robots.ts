import type { MetadataRoute } from "next";

const PRIVATE_DISALLOW = [
  "/api/",
  "/admin/",
  "/church-admin/",
  "/preview/",
  "/church/*/manage",
  "/church/*/embed",
  "/church/*/claim",
];

const INDEXING_DISALLOW = [
  ...PRIVATE_DISALLOW,
  "/church?*q=",
];

// AI-crawler policy (decided 2026-07-01): welcome the search/citation AND the
// major model/grounding crawlers (Gemini, OpenAI, Anthropic) so GospelChannel
// can be cited in AI answers; keep only bulk dataset scrapers blocked.
//
// IMPORTANT: Cloudflare's "Managed robots.txt" (AI Audit) PREPENDS its own block
// for GPTBot/ClaudeBot/Google-Extended/etc. While that managed block is enabled
// it wins for those user-agents regardless of what we emit here. For this file to
// be authoritative, the Cloudflare managed AI-bot robots.txt must be turned OFF in
// the dashboard (AI Audit / AI Crawl Control). This file is written to be the
// correct source of truth once that is done: it explicitly ALLOWS the model
// crawlers we want and explicitly BLOCKS the scrapers we don't.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Traditional search engines
      { userAgent: "Googlebot", allow: "/", disallow: INDEXING_DISALLOW },
      { userAgent: "Bingbot", allow: "/", disallow: INDEXING_DISALLOW },

      // AI search-citation and user-directed retrieval bots
      { userAgent: "OAI-SearchBot", allow: "/", disallow: PRIVATE_DISALLOW },
      { userAgent: "ChatGPT-User", allow: "/", disallow: PRIVATE_DISALLOW },
      { userAgent: "PerplexityBot", allow: "/", disallow: PRIVATE_DISALLOW },
      { userAgent: "Claude-SearchBot", allow: "/", disallow: PRIVATE_DISALLOW },
      { userAgent: "Claude-User", allow: "/", disallow: PRIVATE_DISALLOW },

      // AI model / grounding crawlers welcomed for citation reach. Explicit Allow
      // so we stay open once Cloudflare's managed AI-bot block is disabled.
      { userAgent: "Google-Extended", allow: "/", disallow: PRIVATE_DISALLOW },
      { userAgent: "GPTBot", allow: "/", disallow: PRIVATE_DISALLOW },
      { userAgent: "ClaudeBot", allow: "/", disallow: PRIVATE_DISALLOW },
      { userAgent: "Amazonbot", allow: "/", disallow: PRIVATE_DISALLOW },
      { userAgent: "Applebot-Extended", allow: "/", disallow: PRIVATE_DISALLOW },
      { userAgent: "meta-externalagent", allow: "/", disallow: PRIVATE_DISALLOW },

      // Bulk dataset scrapers with little citation value — stay blocked.
      { userAgent: "CCBot", disallow: "/" },
      { userAgent: "Bytespider", disallow: "/" },
      { userAgent: "Diffbot", disallow: "/" },
      { userAgent: "anthropic-ai", disallow: "/" },

      // Default: allow everything else, block private + search-result areas.
      {
        userAgent: "*",
        allow: "/",
        disallow: INDEXING_DISALLOW,
      },
    ],
    sitemap: "https://gospelchannel.com/sitemap.xml",
  };
}
