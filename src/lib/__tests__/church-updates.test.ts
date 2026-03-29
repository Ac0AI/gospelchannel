import { describe, expect, it } from "vitest";
import { buildGoogleNewsSearchQuery, parseFeedXml } from "../church-updates";

describe("church updates", () => {
  it("parses RSS feed items", () => {
    const items = parseFeedXml(`
      <rss>
        <channel>
          <item>
            <title><![CDATA[Sunday recap]]></title>
            <link>https://example.org/posts/sunday-recap</link>
            <description><![CDATA[<p>Highlights from this weekend.</p>]]></description>
            <pubDate>Wed, 25 Mar 2026 12:00:00 GMT</pubDate>
            <guid>post-1</guid>
          </item>
        </channel>
      </rss>
    `);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Sunday recap");
    expect(items[0].url).toBe("https://example.org/posts/sunday-recap");
    expect(items[0].summary).toBe("Highlights from this weekend.");
    expect(items[0].publishedAt).toBe("2026-03-25T12:00:00.000Z");
  });

  it("parses Atom feed entries", () => {
    const items = parseFeedXml(`
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <title>New teaching series</title>
          <link rel="alternate" href="https://example.org/teaching-series" />
          <summary><![CDATA[<p>Three weeks on hope.</p>]]></summary>
          <updated>2026-03-24T09:30:00Z</updated>
          <id>tag:example.org,2026:series-1</id>
        </entry>
      </feed>
    `);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("New teaching series");
    expect(items[0].url).toBe("https://example.org/teaching-series");
    expect(items[0].summary).toBe("Three weeks on hope.");
    expect(items[0].publishedAt).toBe("2026-03-24T09:30:00.000Z");
  });

  it("builds a Google News fallback query from church name and location", () => {
    expect(buildGoogleNewsSearchQuery({
      churchName: "SOS Church",
      location: "Stockholm, Sweden",
      country: "Sweden",
    })).toBe(`"SOS Church" Stockholm church`);
  });
});
