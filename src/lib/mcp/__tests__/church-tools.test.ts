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
    expect(result.structuredContent).toEqual({ churches: [], city: "Málaga" });
  });

  it("normalizes a country-qualified city in the nearby fallback", async () => {
    const result = await tool("find_churches_near").handler(
      { city: "Málaga, Spain" },
      { meta: {} },
    );

    expect(findChurchesInCityMock).toHaveBeenCalledWith({
      citySlug: "m-laga",
      limit: undefined,
      worshipStyle: undefined,
      denomination: undefined,
      language: undefined,
    });
    expect(result.structuredContent).toEqual({ churches: [], city: "Málaga" });
  });
});
