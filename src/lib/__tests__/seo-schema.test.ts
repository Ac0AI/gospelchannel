import { describe, expect, it } from "vitest";
import { buildArticleSchema, buildGuideSchema, buildHowToSchema, buildItemListSchema, buildOpeningHours } from "@/lib/seo-schema";
import { formatContentFreshness } from "@/lib/utils";

describe("seo schema", () => {
  it("adds optional about and mention entities to article schema", () => {
    const schema = buildArticleSchema({
      url: "https://gospelchannel.com/compare/big-church-vs-small-church",
      headline: "Big Church vs Small Church",
      description: "Choose the church size that fits your first visit.",
      about: ["Church choice", { name: "Church size comparison", url: "https://gospelchannel.com/compare/big-church-vs-small-church" }],
      mentions: [{ name: "Church profile database", url: "https://gospelchannel.com/church" }],
    });

    expect(schema.about).toEqual([
      { "@type": "Thing", name: "Church choice" },
      {
        "@type": "Thing",
        name: "Church size comparison",
        url: "https://gospelchannel.com/compare/big-church-vs-small-church",
      },
    ]);
    expect(schema.mentions).toEqual([
      {
        "@type": "Thing",
        name: "Church profile database",
        url: "https://gospelchannel.com/church",
      },
    ]);
    expect(schema.publisher.logo.url).toBe("https://gospelchannel.com/icon.svg");
  });

  it("formats a real content timestamp without replacing it with request time", () => {
    expect(formatContentFreshness("2026-07-08T14:30:00.000Z")).toEqual({
      updatedIso: "2026-07-08T14:30:00.000Z",
      updatedLabel: "8 July 2026",
    });
  });

  it("marks guide schema as a church choice guide with church details", () => {
    const [article] = buildGuideSchema({
      slug: "first-visit-guide",
      headline: "Your First Church Visit",
      description: "Know what to expect before Sunday.",
    });

    expect(article).toMatchObject({
      "@type": "Article",
      headline: "Your First Church Visit",
      about: [
        { "@type": "Thing", name: "Church choice" },
        { "@type": "Thing", name: "Church choice guide" },
        { "@type": "Thing", name: "Church details" },
      ],
      mentions: [
        {
          "@type": "Thing",
          name: "Explore churches on GospelChannel",
          url: "https://gospelchannel.com/church",
        },
        {
          "@type": "Thing",
          name: "Browse matching churches",
          url: "https://gospelchannel.com/church",
        },
      ],
    });
  });

  it("builds stable HowTo schema with anchored steps", () => {
    const schema = buildHowToSchema({
      name: "How to Find the Right Church",
      description: "A practical guide to choosing a church.",
      url: "https://gospelchannel.com/guides/how-to-find-the-right-church",
      totalTime: "PT60M",
      steps: [
        {
          id: "pick-worship-style",
          title: "Pick a worship style first",
          text: "Choose the sound and room feel before narrowing by denomination.",
        },
        {
          id: "read-profiles",
          title: "Read profile copy and listen to the music",
          text: "Use church profiles as evidence before visiting.",
        },
      ],
    });

    expect(schema).toMatchObject({
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: "How to Find the Right Church",
      totalTime: "PT60M",
      mainEntityOfPage: "https://gospelchannel.com/guides/how-to-find-the-right-church",
    });
    expect(schema.step).toEqual([
      {
        "@type": "HowToStep",
        position: 1,
        name: "Pick a worship style first",
        text: "Choose the sound and room feel before narrowing by denomination.",
        url: "https://gospelchannel.com/guides/how-to-find-the-right-church#pick-worship-style",
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: "Read profile copy and listen to the music",
        text: "Use church profiles as evidence before visiting.",
        url: "https://gospelchannel.com/guides/how-to-find-the-right-church#read-profiles",
      },
    ]);
  });

  it("builds ItemList schema for evidence links", () => {
    const schema = buildItemListSchema({
      name: "Example churches",
      items: [
        { name: "Example Church", url: "https://gospelchannel.com/church/example" },
        { name: "Second Church", url: "https://gospelchannel.com/church/second" },
      ],
    });

    expect(schema).toEqual({
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Example churches",
      numberOfItems: 2,
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Example Church",
          url: "https://gospelchannel.com/church/example",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Second Church",
          url: "https://gospelchannel.com/church/second",
        },
      ],
    });
  });

  it("maps Sunday 10:00 AM to a single opening-hours entry", () => {
    const hours = buildOpeningHours([{ day: "Sunday", time: "10:00 AM" }]);

    expect(hours).toHaveLength(1);
    expect(hours[0].dayOfWeek).toMatch(/\/Sunday$/);
    expect(hours[0].opens).toBe("10:00");
  });

  it("handles plural day names and PM conversion", () => {
    const hours = buildOpeningHours([{ day: "Sundays", time: "4:30 pm" }]);

    expect(hours).toHaveLength(1);
    expect(hours[0].opens).toBe("16:30");
  });

  it("handles 12am/12pm edge cases", () => {
    const midnight = buildOpeningHours([{ day: "Sunday", time: "12:00 am" }]);
    const noon = buildOpeningHours([{ day: "Sunday", time: "12:15 PM" }]);

    expect(midnight[0].opens).toBe("00:00");
    expect(noon[0].opens).toBe("12:15");
  });

  it("skips entries with an unrecognized day or unparseable time", () => {
    const badDay = buildOpeningHours([{ day: "Weekly", time: "10:00 AM" }]);
    const badTime = buildOpeningHours([{ day: "Sunday", time: "morning" }]);

    expect(badDay).toEqual([]);
    expect(badTime).toEqual([]);
  });

  it("keeps only valid entries from a mixed list, preserving order", () => {
    const hours = buildOpeningHours([
      { day: "Sunday", time: "9:00 AM" },
      { day: "Weekly", time: "10:00 AM" },
      { day: "Wednesday", time: "7:00 pm" },
      { day: "Sunday", time: "morning" },
    ]);

    expect(hours).toEqual([
      { "@type": "OpeningHoursSpecification", dayOfWeek: "https://schema.org/Sunday", opens: "09:00" },
      { "@type": "OpeningHoursSpecification", dayOfWeek: "https://schema.org/Wednesday", opens: "19:00" },
    ]);
  });
});
