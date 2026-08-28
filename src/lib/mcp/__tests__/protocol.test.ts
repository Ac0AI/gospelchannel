import { describe, expect, it } from "vitest";
import { handleMcpRequest, type McpServerConfig } from "@/lib/mcp/protocol";

const config: McpServerConfig = {
  serverInfo: { name: "test-server", version: "0.0.0" },
  instructions: "test instructions",
  tools: [
    {
      name: "echo",
      title: "Echo",
      description: "Echoes text back",
      inputSchema: { type: "object", properties: { text: { type: "string" } } },
      outputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
      handler: (args) => ({
        content: [{ type: "text", text: `echo:${String(args.text)}` }],
        structuredContent: { text: args.text },
      }),
    },
    {
      name: "boom",
      title: "Boom",
      description: "Always throws",
      inputSchema: { type: "object" },
      handler: () => {
        throw new Error("kaboom");
      },
    },
  ],
};

async function rpc(body: unknown): Promise<Response> {
  const request = new Request("http://localhost/mcp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleMcpRequest(request, config);
}

describe("mcp protocol handler", () => {
  it("responds to initialize with the client's protocol version and capabilities", async () => {
    const res = await rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } });
    const body = await res.json();
    expect(body.result.protocolVersion).toBe("2025-06-18");
    expect(body.result.capabilities.tools).toBeDefined();
    expect(body.result.serverInfo.name).toBe("test-server");
    expect(body.result.instructions).toBe("test instructions");
  });

  it("lists tools with their input and output schemas", async () => {
    const res = await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    const body = await res.json();
    const names = body.result.tools.map((tool: { name: string }) => tool.name);
    expect(names).toEqual(["echo", "boom"]);
    expect(body.result.tools[0].inputSchema.type).toBe("object");
    expect(body.result.tools[0].outputSchema.required).toEqual(["text"]);
    expect(body.result.tools[1].outputSchema).toBeUndefined();
  });

  it("calls a tool and returns content plus structuredContent", async () => {
    const res = await rpc({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "echo", arguments: { text: "hi" } },
    });
    const body = await res.json();
    expect(body.result.content[0].text).toBe("echo:hi");
    expect(body.result.structuredContent).toEqual({ text: "hi" });
    expect(body.result.isError).toBeFalsy();
  });

  it("returns an isError result when a tool handler throws", async () => {
    const res = await rpc({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "boom", arguments: {} } });
    const body = await res.json();
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toBe("kaboom");
  });

  it("errors on an unknown tool", async () => {
    const res = await rpc({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "nope", arguments: {} } });
    const body = await res.json();
    expect(body.error.code).toBe(-32602);
  });

  it("errors on an unknown method", async () => {
    const res = await rpc({ jsonrpc: "2.0", id: 6, method: "does/not/exist" });
    const body = await res.json();
    expect(body.error.code).toBe(-32601);
  });

  it("returns 202 with no body for a notification", async () => {
    const res = await rpc({ jsonrpc: "2.0", method: "notifications/initialized" });
    expect(res.status).toBe(202);
    expect(await res.text()).toBe("");
  });
});
