import { describe, expect, it } from "vitest";

import nextConfig from "../../../next.config";

describe("next.config security headers", () => {
  it("allows youtube-nocookie embeds in frame-src", async () => {
    const headerRules = await nextConfig.headers?.();
    const rootRule = headerRules?.find((rule) => rule.source === "/(.*)");
    const cspHeader = rootRule?.headers.find((header) => header.key === "Content-Security-Policy");

    expect(cspHeader?.value).toContain("https://www.youtube-nocookie.com");
  });

  it("allows same-origin geolocation while keeping camera and microphone off", async () => {
    const headerRules = await nextConfig.headers?.();
    const rootRule = headerRules?.find((rule) => rule.source === "/(.*)");
    const permissionsPolicy = rootRule?.headers.find((header) => header.key === "Permissions-Policy");

    expect(permissionsPolicy?.value).toBe("camera=(), microphone=(), geolocation=(self)");
  });
});
