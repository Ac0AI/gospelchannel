import { describe, expect, it } from "vitest";
import { isKnownSyntheticAnalyticsClient } from "../analytics-traffic";

const syntheticFingerprint = {
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  referrer: "",
  viewportWidth: 1280,
  viewportHeight: 720,
  screenWidth: 1920,
  screenHeight: 1080,
};

describe("isKnownSyntheticAnalyticsClient", () => {
  it("matches the verified analytics flood fingerprint", () => {
    expect(isKnownSyntheticAnalyticsClient(syntheticFingerprint)).toBe(true);
  });

  it("keeps current browsers with the same display dimensions", () => {
    expect(
      isKnownSyntheticAnalyticsClient({
        ...syntheticFingerprint,
        userAgent: syntheticFingerprint.userAgent.replace("Chrome/119", "Chrome/151"),
      }),
    ).toBe(false);
  });

  it("keeps referred visits even when the remaining fingerprint matches", () => {
    expect(
      isKnownSyntheticAnalyticsClient({
        ...syntheticFingerprint,
        referrer: "https://www.google.com/",
      }),
    ).toBe(false);
  });
});
