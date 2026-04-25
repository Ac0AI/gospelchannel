import { describe, expect, it } from "vitest";
import robots from "@/app/robots";

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

describe("robots", () => {
  it("keeps private URL blocks on every crawler group that may index public pages", () => {
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
});
