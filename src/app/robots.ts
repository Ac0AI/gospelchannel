import type { MetadataRoute } from "next";

// Cloudflare Managed Content (prepended automatically) already disallows
// the major training crawlers: GPTBot, ClaudeBot, CCBot, Bytespider,
// Google-Extended, Applebot-Extended, Amazonbot, meta-externalagent.
// We only list bots NOT covered by CF Managed Content here.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Traditional search engines
      { userAgent: "Googlebot", allow: "/" },
      { userAgent: "Bingbot", allow: "/" },

      // AI search-citation bots (these cite us in AI answers)
      { userAgent: "OAI-SearchBot", allow: "/" },
      { userAgent: "ChatGPT-User", allow: "/" },
      { userAgent: "PerplexityBot", allow: "/" },
      { userAgent: "Claude-SearchBot", allow: "/" },
      { userAgent: "Claude-User", allow: "/" },

      // Training-only bots not covered by Cloudflare Managed Content
      { userAgent: "anthropic-ai", disallow: "/" },
      { userAgent: "Diffbot", disallow: "/" },

      // Default: allow everything else, block private areas
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/church-admin/",
          "/preview/",
          "/church/*/manage",
          "/church/*/embed",
          "/church/*/claim",
          "/church?*q=",
        ],
      },
    ],
    sitemap: "https://gospelchannel.com/sitemap.xml",
  };
}
