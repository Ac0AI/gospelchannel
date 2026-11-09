import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/mcp/church-queries", () => ({
  findChurchesInCity: vi.fn().mockResolvedValue([]),
  findChurchesNear: vi.fn().mockResolvedValue([]),
  getChurchProfile: vi.fn().mockResolvedValue(null),
}));

import { POST } from "@/app/mcp/route";

async function listTools(url: string) {
  const request = new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  });
  return (await (await POST(request)).json()).result.tools;
}

describe("Claude MCP connection", () => {
  it("offers titled city and profile tools without the ChatGPT-only location tool", async () => {
    const tools = await listTools("https://gospelchannel.com/mcp?client=claude");
    expect(tools.map((tool: { name: string }) => tool.name)).toEqual(["find_churches_in_city", "get_church"]);
    for (const tool of tools) expect(tool.annotations).toMatchObject({ title: tool.title, readOnlyHint: true });
  });

  it("preserves the existing MCP tool surface", async () => {
    const tools = await listTools("https://gospelchannel.com/mcp");
    expect(tools.map((tool: { name: string }) => tool.name)).toEqual(["find_churches_near", "find_churches_in_city", "get_church"]);
  });
});
