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

// Cloudflare Managed Content (prepended automatically) already disallows the
// major training crawlers: GPTBot, ClaudeBot, CCBot, Bytespider,
// Google-Extended, Applebot-Extended, Amazonbot, meta-externalagent.
// User-directed retrieval/search agents may access public catalog pages,
// including /church?q=... lookups. Training-only bots stay blocked.
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

      // Training-only bots not covered by Cloudflare Managed Content
      { userAgent: "anthropic-ai", disallow: "/" },
      { userAgent: "Diffbot", disallow: "/" },

      // Default: allow everything else, block private areas
      {
        userAgent: "*",
        allow: "/",
        disallow: INDEXING_DISALLOW,
      },
    ],
    sitemap: "https://gospelchannel.com/sitemap.xml",
  };
}
