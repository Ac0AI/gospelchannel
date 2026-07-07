import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "../json-ld";

describe("serializeJsonLd", () => {
  it("round-trips a plain object", () => {
    const value = {
      "@context": "https://schema.org",
      "@type": "Church",
      name: "St. Example Church",
      numberOfItems: 42,
      nested: { foo: ["bar", "baz"], count: 3 },
    };

    expect(JSON.parse(serializeJsonLd(value))).toEqual(value);
  });

  it("neutralizes a </script> breakout attempt", () => {
    const value = { name: "</script><img src=x onerror=alert(1)>" };
    const serialized = serializeJsonLd(value);

    expect(serialized).not.toContain("<");
  });

  it("preserves the malicious string exactly via escaping, not stripping", () => {
    const value = { name: "</script><img src=x onerror=alert(1)>" };
    const serialized = serializeJsonLd(value);
    const parsed = JSON.parse(serialized) as typeof value;

    expect(parsed.name).toBe(value.name);
  });
});
