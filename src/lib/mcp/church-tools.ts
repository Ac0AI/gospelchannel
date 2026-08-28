// Tool definitions for the GospelChannel church-finder MCP server.
//
// Positioning: "new in a place — find a church that feels like home". Lead with
// fit (worship style, denomination, language, location); service times are a
// bonus shown only when we hold them, never invented.

import { slugify } from "@/lib/slugify";
import type { McpToolDefinition, McpToolResult } from "@/lib/mcp/protocol";
import {
  findChurchesInCity,
  findChurchesNear,
  getChurchProfile,
  type ChurchResult,
} from "@/lib/mcp/church-queries";

export const SERVER_INSTRUCTIONS = [
  "GospelChannel, The Church Guide, helps someone find a Christian church that fits them —",
  "especially when they are new in a place or traveling. Lead with fit: worship",
  "style (contemporary, gospel, charismatic, traditional), denomination, language,",
  "and location. Call find_churches_near when you have or can infer a location;",
  "fall back to find_churches_in_city when only a city is known. Service times are",
  "shown only when recorded and may be stale — always tell the user to confirm with",
  "the church, and never invent a time. Link people to each church's page URL.",
].join(" ");

// Every tool is a read-only lookup over our own church directory: no writes,
// nothing destructive, no public-internet side effects. Declared so ChatGPT's
// reviewer and clients can trust the safety surface.
const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const;

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  return undefined;
}

// ChatGPT passes the user's coarse location in _meta["openai/userLocation"].
// Shape is not strictly guaranteed, so read defensively.
function extractMetaLocation(meta: Record<string, unknown>): { lat?: number; lng?: number; city?: string } {
  const loc = meta["openai/userLocation"];
  if (!loc || typeof loc !== "object") return {};
  const record = loc as Record<string, unknown>;
  const coords = (record.coordinates && typeof record.coordinates === "object" ? record.coordinates : record) as Record<
    string,
    unknown
  >;
  const lat = asNumber(coords.latitude) ?? asNumber(coords.lat);
  const lng = asNumber(coords.longitude) ?? asNumber(coords.lon) ?? asNumber(coords.lng);
  const city = asString(record.city);
  return { lat, lng, city };
}

function textResult(text: string, structuredContent: Record<string, unknown>, isError = false): McpToolResult {
  return { content: [{ type: "text", text }], structuredContent, isError };
}

function summarizeList(churches: ChurchResult[], heading: string): string {
  if (churches.length === 0) {
    return `No matching churches found ${heading}. Try widening the radius or relaxing the worship-style/denomination filters.`;
  }
  const lines = churches.slice(0, 8).map((church) => {
    const bits = [church.name];
    if (church.location) bits.push(church.location);
    if (typeof church.distanceKm === "number") bits.push(`${church.distanceKm} km away`);
    const styles = church.worshipStyles.length ? ` - ${church.worshipStyles.join(", ")}` : "";
    return `- ${bits.join(", ")}${styles} (${church.url})`;
  });
  return `Found ${churches.length} church(es) ${heading}:\n${lines.join("\n")}`;
}

const findChurchesNearTool: McpToolDefinition = {
  name: "find_churches_near",
  title: "Find churches near a place",
  annotations: READ_ONLY_ANNOTATIONS,
  description:
    "Find Christian worship churches near the user, ranked by distance. Use when the person is new in a place or traveling. Uses the coarse location ChatGPT shares; if only a city is named, it searches that city. Filter by worship style, denomination, or language.",
  inputSchema: {
    type: "object",
    properties: {
      city: { type: "string", description: "City name to search in, when a specific city is mentioned." },
      worship_style: {
        type: "string",
        description: "Preferred worship style, e.g. contemporary, gospel, charismatic, traditional, hillsong.",
      },
      denomination: {
        type: "string",
        description: "Preferred denomination, e.g. non-denominational, Baptist, Pentecostal, Assemblies of God.",
      },
      language: { type: "string", description: "Preferred service language, e.g. English, Spanish." },
      radius_km: { type: "number", description: "Search radius in kilometers (default 40, max 500)." },
      limit: { type: "number", description: "Maximum number of churches to return (default 5, max 20)." },
    },
  },
  handler: async (args, { meta }) => {
    // Coordinates come only from ChatGPT's shared coarse location, never the
    // input schema — per Apps SDK guidelines we don't request precise location.
    const metaLoc = extractMetaLocation(meta);
    const lat = metaLoc.lat;
    const lng = metaLoc.lng;
    const filters = {
      worshipStyle: asString(args.worship_style),
      denomination: asString(args.denomination),
      language: asString(args.language),
    };
    const limit = asNumber(args.limit);
    const radiusKm = asNumber(args.radius_km);

    if (lat != null && lng != null) {
      const churches = await findChurchesNear({ latitude: lat, longitude: lng, radiusKm, limit, ...filters });
      return textResult(summarizeList(churches, "near you"), { churches, center: { latitude: lat, longitude: lng } });
    }

    // No coordinates — fall back to a city search.
    const city = asString(args.city) ?? metaLoc.city;
    if (city) {
      const citySlug = slugify(city);
      const churches = await findChurchesInCity({ citySlug, limit, ...filters });
      return textResult(summarizeList(churches, `in ${city}`), { churches, city });
    }

    return textResult(
      "I need a location - share your location or name a city.",
      { churches: [] },
      true,
    );
  },
};

const findChurchesInCityTool: McpToolDefinition = {
  name: "find_churches_in_city",
  title: "Find churches in a city",
  annotations: READ_ONLY_ANNOTATIONS,
  description:
    "Find Christian worship churches in a named city, ranked by directory quality. Filter by worship style, denomination, or language.",
  inputSchema: {
    type: "object",
    properties: {
      city: { type: "string", description: "City name, e.g. Austin, Barcelona, London." },
      worship_style: {
        type: "string",
        description: "Preferred worship style, e.g. contemporary, gospel, charismatic, traditional, hillsong.",
      },
      denomination: {
        type: "string",
        description: "Preferred denomination, e.g. non-denominational, Baptist, Pentecostal.",
      },
      language: { type: "string", description: "Preferred service language, e.g. English, Spanish." },
      limit: { type: "number", description: "Maximum number of churches to return (default 8, max 20)." },
    },
    required: ["city"],
  },
  handler: async (args) => {
    const city = asString(args.city);
    if (!city) {
      return textResult("Please provide a city name.", { churches: [] }, true);
    }
    const citySlug = slugify(city);
    const churches = await findChurchesInCity({
      citySlug,
      limit: asNumber(args.limit),
      worshipStyle: asString(args.worship_style),
      denomination: asString(args.denomination),
      language: asString(args.language),
    });
    return textResult(summarizeList(churches, `in ${city}`), { churches, city });
  },
};

const getChurchTool: McpToolDefinition = {
  name: "get_church",
  title: "Get a church profile",
  annotations: READ_ONLY_ANNOTATIONS,
  description:
    "Get the full profile for one church by its slug (the last path segment of its gospelchannel.com/church/<slug> URL): worship styles, denomination, language, description, top worship songs, contact, and recorded service times if available.",
  inputSchema: {
    type: "object",
    properties: {
      slug: { type: "string", description: "The church slug, e.g. hillsong-church-london." },
    },
    required: ["slug"],
  },
  handler: async (args) => {
    const slug = asString(args.slug);
    if (!slug) {
      return textResult("Please provide a church slug.", { church: null }, true);
    }
    const church = await getChurchProfile(slug);
    if (!church) {
      return textResult(`No church found for slug "${slug}".`, { church: null }, true);
    }
    const styles = church.worshipStyles.length ? ` Worship: ${church.worshipStyles.join(", ")}.` : "";
    const denom = church.denomination ? ` ${church.denomination}.` : "";
    return textResult(`${church.name} - ${church.location ?? church.country ?? ""}.${denom}${styles} ${church.url}`, {
      church,
    });
  },
};

export const CHURCH_TOOLS: McpToolDefinition[] = [findChurchesNearTool, findChurchesInCityTool, getChurchTool];
