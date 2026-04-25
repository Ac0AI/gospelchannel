import type { MetadataRoute } from "next";

const PRIVATE_DISALLOW = [
  "/api/",
  "/admin/",
  "/church-admin/",
  "/preview/",
  "/church/*/manage",
  "/church/*/embed",
  "/church/*/claim",
  "/church?*q=",
];

// Cloudflare Managed Content (prepended automatically) already disallows
// the major training crawlers: GPTBot, ClaudeBot, CCBot, Bytespider,
// Google-Extended, Applebot-Extended, Amazonbot, meta-externalagent.
// We only list bots NOT covered by CF Managed Content here.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Traditional search engines
      { userAgent: "Googlebot", allow: "/", disallow: PRIVATE_DISALLOW },
      { userAgent: "Bingbot", allow: "/", disallow: PRIVATE_DISALLOW },

      // AI search-citation bots (these cite us in AI answers)
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
        disallow: PRIVATE_DISALLOW,
      },
    ],
    sitemap: "https://gospelchannel.com/sitemap.xml",
  };
}
