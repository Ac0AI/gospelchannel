// Model Context Protocol endpoint. POST JSON-RPC here to list and call the
// church-finder tools. The same URL powers a ChatGPT App and works in Claude /
// Cursor. Public, no auth (public directory data); D1 is protected by the
// R2-backed cache in church-queries.ts and a Cloudflare edge rate-limit on POST
// /mcp.

import type { NextRequest } from "next/server";
import { CHURCH_TOOLS, SERVER_INSTRUCTIONS } from "@/lib/mcp/church-tools";
import { handleMcpRequest, MCP_CORS_HEADERS, type McpServerConfig } from "@/lib/mcp/protocol";

export const dynamic = "force-dynamic";

const SERVER_CONFIG: McpServerConfig = {
  serverInfo: { name: "GospelChannel Church Finder", version: "1.0.0" },
  instructions: SERVER_INSTRUCTIONS,
  tools: CHURCH_TOOLS,
};

// Claude does not supply ChatGPT's location metadata. Keep the same protected
// endpoint while exposing only tools that work with an explicitly named city.
const CLAUDE_SERVER_CONFIG: McpServerConfig = {
  serverInfo: SERVER_CONFIG.serverInfo,
  instructions: "Find Christian churches in a named city and show their public profiles. Ask for a city when needed. Service times may be incomplete or stale; confirm them with the church before visiting.",
  tools: CHURCH_TOOLS.filter((tool) => tool.name !== "find_churches_near").map((tool) => ({
    ...tool,
    annotations: { ...tool.annotations, title: tool.title },
  })),
};

export async function POST(request: NextRequest): Promise<Response> {
  const config = request.nextUrl.searchParams.get("client") === "claude" ? CLAUDE_SERVER_CONFIG : SERVER_CONFIG;
  return handleMcpRequest(request, config);
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: MCP_CORS_HEADERS });
}

export function GET(): Response {
  // Stateless server — no server-initiated SSE stream. Per the MCP Streamable
  // HTTP spec, respond 405 to GET and point clients at POST.
  return new Response(
    JSON.stringify({
      error: "Method Not Allowed. This is a Model Context Protocol endpoint – send JSON-RPC over POST.",
      server: SERVER_CONFIG.serverInfo.name,
    }),
    {
      status: 405,
      headers: { "content-type": "application/json", Allow: "POST, OPTIONS", ...MCP_CORS_HEADERS },
    },
  );
}
