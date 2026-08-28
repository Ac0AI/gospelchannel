import { beforeEach, describe, expect, it, vi } from "vitest";

const { findChurchesInCityMock, findChurchesNearMock, getChurchProfileMock } = vi.hoisted(() => ({
  findChurchesInCityMock: vi.fn(),
  findChurchesNearMock: vi.fn(),
  getChurchProfileMock: vi.fn(),
}));

vi.mock("@/lib/mcp/church-queries", () => ({
  findChurchesInCity: findChurchesInCityMock,
  findChurchesNear: findChurchesNearMock,
  getChurchProfile: getChurchProfileMock,
}));

import { CHURCH_TOOLS } from "@/lib/mcp/church-tools";

function tool(name: string) {
  const match = CHURCH_TOOLS.find((candidate) => candidate.name === name);
  if (!match) throw new Error(`Missing tool: ${name}`);
  return match;
}

describe("church MCP tools", () => {
  beforeEach(() => {
    findChurchesInCityMock.mockReset().mockResolvedValue([]);
    findChurchesNearMock.mockReset().mockResolvedValue([]);
    getChurchProfileMock.mockReset().mockResolvedValue(null);
  });

  it("accepts a country-qualified city from ChatGPT", async () => {
    const result = await tool("find_churches_in_city").handler(
      { city: "Málaga, Spain", limit: 20 },
      { meta: {} },
    );

    expect(findChurchesInCityMock).toHaveBeenCalledWith({
      citySlug: "m-laga",
      limit: 20,
      worshipStyle: undefined,
      denomination: undefined,
      language: undefined,
    });
    expect(result.structuredContent).toEqual({ churches: [], count: 0, city: "Málaga" });
  });

  it("normalizes a country-qualified city in the nearby fallback", async () => {
    const result = await tool("find_churches_near").handler(
      {},
      { meta: { "openai/userLocation": { city: "Málaga, Spain" } } },
    );

    expect(findChurchesInCityMock).toHaveBeenCalledWith({
      citySlug: "m-laga",
      limit: undefined,
      worshipStyle: undefined,
      denomination: undefined,
      language: undefined,
    });
    expect(result.structuredContent).toEqual({ churches: [], count: 0, city: "Málaga" });
  });

  it("uses coarse client location without returning coordinates to the model", async () => {
    const result = await tool("find_churches_near").handler(
      { radius_km: 25 },
      { meta: { "openai/userLocation": { latitude: 36.72, longitude: -4.42, city: "Málaga" } } },
    );

    expect(findChurchesNearMock).toHaveBeenCalledWith({
      latitude: 36.72,
      longitude: -4.42,
      radiusKm: 25,
      limit: undefined,
      worshipStyle: undefined,
      denomination: undefined,
      language: undefined,
    });
    expect(result.structuredContent).toEqual({ churches: [], count: 0 });
  });

  it("returns an explicit result count so the model does not confuse it with the limit", async () => {
    findChurchesInCityMock.mockResolvedValue([
      {
        slug: "one",
        name: "One Church",
        url: "https://gospelchannel.com/church/one",
        location: "London",
        country: "United Kingdom",
        denomination: null,
        worshipStyles: [],
        language: null,
        website: null,
        imageUrl: null,
        summary: null,
      },
      {
        slug: "two",
        name: "Two Church",
        url: "https://gospelchannel.com/church/two",
        location: "London",
        country: "United Kingdom",
        denomination: null,
        worshipStyles: [],
        language: null,
        website: null,
        imageUrl: null,
        summary: null,
      },
    ]);

    const result = await tool("find_churches_in_city").handler(
      { city: "London", limit: 20 },
      { meta: {} },
    );

    expect(result.structuredContent).toEqual({
      churches: [
        {
          slug: "one",
          name: "One Church",
          url: "https://gospelchannel.com/church/one",
          location: "London",
          country: "United Kingdom",
          denomination: null,
          worshipStyles: [],
          language: null,
        },
        {
          slug: "two",
          name: "Two Church",
          url: "https://gospelchannel.com/church/two",
          location: "London",
          country: "United Kingdom",
          denomination: null,
          worshipStyles: [],
          language: null,
        },
      ],
      count: 2,
      city: "London",
    });
  });

  it("omits copied images and long source descriptions from profile responses", async () => {
    getChurchProfileMock.mockResolvedValue({
      slug: "one",
      name: "One Church",
      url: "https://gospelchannel.com/church/one",
      location: "London",
      country: "United Kingdom",
      denomination: "Baptist",
      worshipStyles: ["contemporary worship"],
      language: "English",
      website: "https://one.example",
      imageUrl: "https://media.gospelchannel.com/one.jpg",
      summary: "A concise GospelChannel summary.",
      description: "A long source description.",
      whatToExpect: "A welcoming Sunday service.",
      pastorName: null,
      streetAddress: null,
      topSongs: [],
    });

    const result = await tool("get_church").handler({ slug: "one" }, { meta: {} });

    expect(result.structuredContent?.church).toMatchObject({
      slug: "one",
      summary: "A concise GospelChannel summary.",
      whatToExpect: "A welcoming Sunday service.",
    });
    expect(result.structuredContent?.church).not.toHaveProperty("imageUrl");
    expect(result.structuredContent?.church).not.toHaveProperty("description");
  });
});
