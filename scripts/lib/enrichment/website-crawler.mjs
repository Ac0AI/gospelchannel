/**
 * Crawl a church website using Firecrawl and return markdown content.
 * Saves ALL crawled pages as raw data for future re-extraction.
 */
import { FirecrawlAppV1 } from "@mendable/firecrawl-js";

const RELEVANT_PATHS = [
  "/about", "/about-us", "/visit", "/plan-your-visit",
  "/service-times", "/services", "/beliefs", "/what-we-believe",
  "/our-beliefs", "/faith", "/ministries", "/contact",
  "/connect", "/new-here", "/im-new",
];

/**
 * @param {string} websiteUrl - Church website URL
 * @param {string} firecrawlKey - Firecrawl API key
 * @returns {Promise<{ pages: Array, homepageMarkdown: string|null }>}
 */
export async function crawlChurchWebsite(websiteUrl, firecrawlKey) {
  const app = new FirecrawlAppV1({ apiKey: firecrawlKey });
  console.log(`  [crawl] Crawling: ${websiteUrl}`);

  try {
    let targetUrls = [websiteUrl];

    try {
      const mapResult = await app.mapUrl(websiteUrl, {});
      if (mapResult?.links) {
        const relevant = mapResult.links.filter((url) =>
          RELEVANT_PATHS.some((path) => url.toLowerCase().includes(path))
        );
        targetUrls = [websiteUrl, ...relevant.slice(0, 4)];
        targetUrls = [...new Set(targetUrls)];
      }
    } catch {
      console.log(`  [crawl] Map failed, crawling homepage only`);
    }

    console.log(`  [crawl] Scraping ${targetUrls.length} page(s)`);

    const results = await Promise.allSettled(
      targetUrls.map(async (url) => {
        const result = await app.scrapeUrl(url, { formats: ["markdown"] });
        if (result?.markdown) {
          return { url, markdown: result.markdown, crawledAt: new Date().toISOString() };
        }
        return null;
      })
    );

    const pages = [];
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === "fulfilled" && r.value) {
        pages.push(r.value);
      } else if (r.status === "rejected") {
        console.log(`  [crawl] Failed to scrape ${targetUrls[i]}: ${r.reason?.message}`);
      }
    }

    const homepageMarkdown = pages[0]?.markdown || null;
    console.log(`  [crawl] Got ${pages.length} page(s), homepage: ${homepageMarkdown ? homepageMarkdown.length + ' chars' : 'none'}`);

    return { pages, homepageMarkdown };
  } catch (err) {
    console.error(`  [crawl] Error: ${err.message}`);
    return { pages: [], homepageMarkdown: null };
  }
}

/**
 * Fallback: fetch a URL with native fetch and extract basic text.
 */
export async function fetchPageAsText(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "GospelChannel/1.0 (church-enrichment)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, 50000);
  } catch {
    return null;
  }
}
