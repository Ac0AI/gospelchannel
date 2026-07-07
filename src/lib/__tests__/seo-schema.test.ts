import { describe, expect, it } from "vitest";
import { buildArticleSchema, buildGuideSchema, buildHowToSchema, buildItemListSchema } from "@/lib/seo-schema";

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
  });

  it("marks guide schema as a church decision guide backed by profile evidence", () => {
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
        { "@type": "Thing", name: "Church decision guide" },
        { "@type": "Thing", name: "Church profile evidence" },
      ],
      mentions: [
        {
          "@type": "Thing",
          name: "GospelChannel church profile database",
          url: "https://gospelchannel.com/church",
        },
        {
          "@type": "Thing",
          name: "Church proof routes",
          url: "https://gospelchannel.com/guides",
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
});
