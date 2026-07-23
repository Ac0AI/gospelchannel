// Model Context Protocol endpoint. POST JSON-RPC here to list and call the
// church-finder tools. The same URL powers a ChatGPT App and works in Claude /
// Cursor. Public, no auth (public directory data); Neon is protected by the
// R2-backed cache in church-queries.ts. Add a Cloudflare edge rate-limit rule on
// /mcp before public launch.

import type { NextRequest } from "next/server";
import { CHURCH_TOOLS, SERVER_INSTRUCTIONS } from "@/lib/mcp/church-tools";
import { handleMcpRequest, MCP_CORS_HEADERS, type McpServerConfig } from "@/lib/mcp/protocol";

export const dynamic = "force-dynamic";

const SERVER_CONFIG: McpServerConfig = {
  serverInfo: { name: "GospelChannel Church Finder", version: "1.0.0" },
  instructions: SERVER_INSTRUCTIONS,
  tools: CHURCH_TOOLS,
};

export async function POST(request: NextRequest): Promise<Response> {
  return handleMcpRequest(request, SERVER_CONFIG);
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: MCP_CORS_HEADERS });
}

export function GET(): Response {
  // Stateless server — no server-initiated SSE stream. Per the MCP Streamable
  // HTTP spec, respond 405 to GET and point clients at POST.
  return new Response(
    JSON.stringify({
      error: "Method Not Allowed. This is a Model Context Protocol endpoint — send JSON-RPC over POST.",
      server: SERVER_CONFIG.serverInfo.name,
    }),
    {
      status: 405,
      headers: { "content-type": "application/json", Allow: "POST, OPTIONS", ...MCP_CORS_HEADERS },
    },
  );
}
