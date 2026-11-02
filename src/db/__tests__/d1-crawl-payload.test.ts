import { describe, expect, it } from "vitest";
import { decodeCrawlPayload } from "../d1-crawl-payload";

describe("D1 crawl payload chunks", () => {
  it("reconstructs chunks in order", () => {
    expect(decodeCrawlPayload([{ part: 1, value: 'ö"}]' }, { part: 0, value: '[{"text":"' }])).toEqual([{ text: "ö" }]);
  });
  it("distinguishes a missing payload from missing chunks", () => {
    expect(decodeCrawlPayload([])).toBeNull();
    expect(() => decodeCrawlPayload([{ part: 1, value: "[]" }])).toThrow("Incomplete crawl payload");
    expect(() => decodeCrawlPayload([{ part: 0, value: "[" }])).toThrow();
  });
});
