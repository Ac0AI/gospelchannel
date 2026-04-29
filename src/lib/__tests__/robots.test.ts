import { describe, expect, it } from "vitest";
import robots from "@/app/robots";

// Always blocked, regardless of crawler — admin/preview/private endpoints.
const PRIVATE_DISALLOW = [
  "/api/",
  "/admin/",
  "/church-admin/",
  "/preview/",
  "/church/*/manage",
  "/church/*/embed",
  "/church/*/claim",
];

// Indexing crawlers (traditional search) also stay out of search-result pages
// since they generate near-duplicate thin pages. User-directed retrieval bots
// (OAI-SearchBot, Claude-User, etc.) need /church?q=... access — that's the
// whole point of letting them in.
const INDEXING_ONLY_BLOCKS = ["/church?*q="];

describe("robots", () => {
  it("blocks private URLs on every crawler group", () => {
    const config = robots();
    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];

    for (const userAgent of [
      "Googlebot",
      "Bingbot",
      "OAI-SearchBot",
      "ChatGPT-User",
      "PerplexityBot",
      "Claude-SearchBot",
      "Claude-User",
      "*",
    ]) {
      const rule = rules.find((candidate) => candidate.userAgent === userAgent);

      expect(rule, userAgent).toBeDefined();
      expect(rule?.allow).toBe("/");
      expect(rule?.disallow).toEqual(expect.arrayContaining(PRIVATE_DISALLOW));
    }
  });

  it("blocks /church?q= on indexing crawlers but allows it on retrieval bots", () => {
    const config = robots();
    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];

    for (const userAgent of ["Googlebot", "Bingbot", "*"]) {
      const rule = rules.find((candidate) => candidate.userAgent === userAgent);
      expect(rule?.disallow, userAgent).toEqual(
        expect.arrayContaining(INDEXING_ONLY_BLOCKS),
      );
    }

    for (const userAgent of [
      "OAI-SearchBot",
      "ChatGPT-User",
      "PerplexityBot",
      "Claude-SearchBot",
      "Claude-User",
    ]) {
      const rule = rules.find((candidate) => candidate.userAgent === userAgent);
      expect(rule?.disallow, userAgent).not.toContain("/church?*q=");
    }
  });
});
