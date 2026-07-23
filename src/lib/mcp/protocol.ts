// Minimal, stateless Model Context Protocol server over JSON-RPC.
//
// We hand-roll the protocol instead of using the SDK's Node-stream transport,
// which is fragile on Cloudflare Workers. This handler takes a Web `Request`
// and returns a Web `Response`, so it drops straight into an App Router route.
//
// Stateless: no session id, one JSON-RPC message (or batch) per POST, JSON
// response only (no server-initiated SSE). That is all ChatGPT / Claude / Cursor
// need to list and call tools.

// The protocol revision we speak if the client does not name one. We echo the
// client's requested version when present (maximally compatible).
const FALLBACK_PROTOCOL_VERSION = "2025-06-18";

export type JsonSchema = Record<string, unknown>;

export type McpToolResult = {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

export type McpToolHandler = (
  args: Record<string, unknown>,
  context: { meta: Record<string, unknown> },
) => Promise<McpToolResult> | McpToolResult;

export type McpToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  outputSchema?: JsonSchema;
  annotations?: Record<string, unknown>;
  handler: McpToolHandler;
};

export type McpServerConfig = {
  serverInfo: { name: string; version: string };
  instructions?: string;
  tools: McpToolDefinition[];
};

// JSON-RPC error codes we use.
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

export const MCP_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, mcp-protocol-version, authorization",
  "Access-Control-Max-Age": "86400",
};

type JsonRpcId = string | number | null;

type JsonRpcMessage = {
  jsonrpc?: unknown;
  id?: JsonRpcId;
  method?: unknown;
  params?: unknown;
};

function resultResponse(id: JsonRpcId, result: unknown) {
  return { jsonrpc: "2.0" as const, id, result };
}

function errorResponse(id: JsonRpcId, code: number, message: string, data?: unknown) {
  return { jsonrpc: "2.0" as const, id, error: data === undefined ? { code, message } : { code, message, data } };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...MCP_CORS_HEADERS },
  });
}

function toolListPayload(tools: McpToolDefinition[]) {
  return {
    tools: tools.map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      ...(tool.outputSchema ? { outputSchema: tool.outputSchema } : {}),
      ...(tool.annotations ? { annotations: tool.annotations } : {}),
    })),
  };
}

// Dispatch a single JSON-RPC message. Returns the response object, or null for
// notifications (which get no reply per JSON-RPC).
async function dispatch(
  message: JsonRpcMessage,
  config: McpServerConfig,
): Promise<ReturnType<typeof resultResponse> | ReturnType<typeof errorResponse> | null> {
  const { id = null, method } = message;
  const isNotification = message.id === undefined || message.id === null;

  if (typeof method !== "string") {
    return isNotification ? null : errorResponse(id, INVALID_REQUEST, "Missing method");
  }

  // Notifications (initialized, cancelled, progress, …) get no response.
  if (isNotification) return null;

  switch (method) {
    case "initialize": {
      const params = (message.params ?? {}) as { protocolVersion?: unknown };
      const protocolVersion =
        typeof params.protocolVersion === "string" ? params.protocolVersion : FALLBACK_PROTOCOL_VERSION;
      return resultResponse(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: config.serverInfo,
        ...(config.instructions ? { instructions: config.instructions } : {}),
      });
    }
    case "ping":
      return resultResponse(id, {});
    case "tools/list":
      return resultResponse(id, toolListPayload(config.tools));
    case "tools/call": {
      const params = (message.params ?? {}) as {
        name?: unknown;
        arguments?: unknown;
        _meta?: unknown;
      };
      if (typeof params.name !== "string") {
        return errorResponse(id, INVALID_PARAMS, "Missing tool name");
      }
      const tool = config.tools.find((candidate) => candidate.name === params.name);
      if (!tool) {
        return errorResponse(id, INVALID_PARAMS, `Unknown tool: ${params.name}`);
      }
      const args =
        params.arguments && typeof params.arguments === "object"
          ? (params.arguments as Record<string, unknown>)
          : {};
      const meta =
        params._meta && typeof params._meta === "object" ? (params._meta as Record<string, unknown>) : {};
      try {
        const result = await tool.handler(args, { meta });
        return resultResponse(id, result);
      } catch (error) {
        // Tool failures are returned as model-visible content, not JSON-RPC
        // errors, so the assistant can recover gracefully.
        const text = error instanceof Error ? error.message : "Tool execution failed";
        return resultResponse(id, {
          content: [{ type: "text", text }],
          isError: true,
        });
      }
    }
    default:
      return errorResponse(id, METHOD_NOT_FOUND, `Unknown method: ${method}`);
  }
}

export async function handleMcpRequest(request: Request, config: McpServerConfig): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(errorResponse(null, PARSE_ERROR, "Invalid JSON"), 400);
  }

  // JSON-RPC batch: array of messages.
  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      return jsonResponse(errorResponse(null, INVALID_REQUEST, "Empty batch"), 400);
    }
    const responses = (
      await Promise.all(payload.map((message) => dispatch(message as JsonRpcMessage, config)))
    ).filter((entry): entry is NonNullable<typeof entry> => entry !== null);
    // All notifications → 202 with no body.
    if (responses.length === 0) return new Response(null, { status: 202, headers: MCP_CORS_HEADERS });
    return jsonResponse(responses);
  }

  if (!payload || typeof payload !== "object") {
    return jsonResponse(errorResponse(null, INVALID_REQUEST, "Invalid request"), 400);
  }

  const response = await dispatch(payload as JsonRpcMessage, config);
  if (response === null) return new Response(null, { status: 202, headers: MCP_CORS_HEADERS });
  return jsonResponse(response);
}
