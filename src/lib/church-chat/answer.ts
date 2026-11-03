// Server side of the search-box chat. Claude looks churches up with the same
// directory queries the MCP server uses; the cards the visitor sees are built
// from those query results, so names, places and service times always come
// from the directory, never from model text.

import Anthropic from "@anthropic-ai/sdk";
import { sanitizeServiceTimes } from "@/lib/content-quality";
import {
  findChurchesInCity,
  findChurchesNear,
  getChurchProfile,
  type ChurchResult,
} from "@/lib/mcp/church-queries";
import { getChurchSearchSuggestions } from "@/lib/search-suggestions";
import { slugify } from "@/lib/slugify";
import { resolvePlace } from "@/lib/search/resolve-place";
import { tokenize } from "@/lib/search/text";
import type { ServiceTime } from "@/types/gospel";
import type { ChurchChatAnswer, ChurchChatCard, ChurchChatGuide, ChurchChatRequest } from "./types";

export const CHURCH_CHAT_MODEL = "claude-opus-5-5";
const FALLBACK_BETA = "server-side-fallback-2026-07-01";
const MAX_ROUNDS = 3;
const MAX_CARDS = 6;
const MAX_REPLY_CHARS = 600;

export const CHURCH_CHAT_GUIDES: Record<string, Omit<ChurchChatGuide, "key">> = {
  "first-visit": { title: "What to expect on a first visit", href: "/guides/first-visit-guide" },
  "worship-styles": { title: "Worship styles explained", href: "/guides/worship-styles-explained" },
  denominations: { title: "How Christian denominations differ", href: "/guides/denominations-comparison" },
  choosing: { title: "How to find the right church", href: "/guides/how-to-find-the-right-church" },
};

const SYSTEM_PROMPT = [
  "You are the church guide on GospelChannel (gospelchannel.com), a directory of Christian churches focused on evangelical, charismatic and free churches.",
  "You help someone find a church that fits them: worship style, denomination, language, location, and things like a kids or students ministry.",
  "",
  "How to answer:",
  "- Look churches up with the tools. Never name a church, service time, address, phone number or web address that a tool did not return.",
  "- The page shows the churches you found as cards with their details directly under your message. Do not list them and do not repeat addresses. Write one or two short sentences (under 40 words) saying what you found and why it fits, or ask one short question when you need to.",
  "- Mention service times only when the question is about when a church meets, and only times a tool returned.",
  "- Plain text only: no markdown, no lists, no links.",
  "- Answer in the language the person wrote in.",
  "- If they did not say where, ask which city, unless the find_churches_near_user tool is available.",
  "- If a search finds nothing, try once more without the style, denomination or language filter, then say plainly what you found.",
  "- For questions about visiting a church, worship styles or denominations, answer briefly and call show_guide with the matching guide.",
  "- Service times in the directory can be out of date. When times matter, say to confirm with the church.",
  "- If the question has nothing to do with finding or visiting a church, say in one sentence what you can help with.",
].join("\n");

const FILTER_PROPERTIES = {
  worship_style: {
    type: "string",
    description: "Preferred worship style, e.g. contemporary, gospel, charismatic, traditional, hillsong.",
  },
  denomination: {
    type: "string",
    description:
      "Preferred denomination or family, e.g. non-denominational, Baptist, Pentecostal, evangelical. \"charismatic\" also covers Pentecostal and Vineyard churches.",
  },
  language: { type: "string", description: "Preferred service language, e.g. English, Spanish." },
} as const;

const CITY_TOOL: Anthropic.Beta.BetaTool = {
  name: "find_churches_in_city",
  description: "Find churches in a named city, best matches first. Optional filters for worship style, denomination and language.",
  input_schema: {
    type: "object",
    properties: {
      city: { type: "string", description: "City name only, e.g. Madrid." },
      country: {
        type: "string",
        description: "The city's country in English, e.g. Spain. Pass it whenever you know it: several cities share a name.",
      },
      ...FILTER_PROPERTIES,
    },
    required: ["city"],
  },
};

const NAME_TOOL: Anthropic.Beta.BetaTool = {
  name: "find_church_by_name",
  description: "Look up one specific church by its name, optionally with its city, e.g. to answer when it meets.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "The church's name." },
      city: { type: "string", description: "The church's city, if known." },
    },
    required: ["name"],
  },
};

const NEAR_TOOL: Anthropic.Beta.BetaTool = {
  name: "find_churches_near_user",
  description: "Find churches near the visitor's shared location, nearest first. Optional filters.",
  input_schema: { type: "object", properties: { ...FILTER_PROPERTIES } },
};

const GUIDE_TOOL: Anthropic.Beta.BetaTool = {
  name: "show_guide",
  description: "Show a link to one of GospelChannel's guides under your answer.",
  input_schema: {
    type: "object",
    properties: {
      guide: {
        type: "string",
        enum: Object.keys(CHURCH_CHAT_GUIDES),
        description: "first-visit, worship-styles, denominations, or choosing (how to pick a church).",
      },
    },
    required: ["guide"],
  },
};

type CreateMessage = (
  params: Anthropic.Beta.MessageCreateParamsNonStreaming & { fallbacks: "default" },
) => Promise<Anthropic.Beta.BetaMessage>;

export type ChurchChatDeps = {
  createMessage: CreateMessage;
  findChurchesInCity: typeof findChurchesInCity;
  findChurchesNear: typeof findChurchesNear;
  getChurchProfile: typeof getChurchProfile;
  getChurchSearchSuggestions: typeof getChurchSearchSuggestions;
  /** Directory city slug for a misspelled or foreign-language city name ("stokholm", "Gothenburg"). */
  resolveCitySlug?: (city: string) => Promise<string | null>;
};

async function resolveCitySlugFromDirectory(city: string): Promise<string | null> {
  // Imported lazily: the lookup pulls in the whole directory module.
  const { directoryPlaceLookup } = await import("@/lib/search/directory-place-lookup");
  const place = await resolvePlace(tokenize(city), undefined, directoryPlaceLookup, { hasConcepts: true });
  return place.city?.citySlug ?? null;
}

export function defaultChurchChatDeps(apiKey: string): ChurchChatDeps {
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 25_000 });
  return {
    createMessage: (params) => client.beta.messages.create(params),
    findChurchesInCity,
    findChurchesNear,
    getChurchProfile,
    getChurchSearchSuggestions,
    resolveCitySlug: resolveCitySlugFromDirectory,
  };
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function serviceTimeSlots(times: unknown): ServiceTime[] {
  return Array.isArray(times) ? sanitizeServiceTimes(times as ServiceTime[]) : [];
}

function serviceTimeSummary(times: unknown): string | null {
  const slots = serviceTimeSlots(times).slice(0, 3);
  return slots.length ? slots.map((slot) => `${slot.day} ${slot.time}`).join(" · ") : null;
}

function languageName(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^[a-z]{2,3}$/i.test(trimmed)) {
    try {
      return new Intl.DisplayNames(["en"], { type: "language" }).of(trimmed.toLowerCase()) ?? trimmed;
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

export function toChatCard(church: ChurchResult): ChurchChatCard {
  const place = [church.location, church.country].filter(Boolean).join(", ") || null;
  return {
    slug: church.slug,
    name: church.name,
    href: `/church/${church.slug}`,
    place,
    denomination: church.denomination,
    styles: church.worshipStyles.slice(0, 3),
    language: languageName(church.language),
    serviceTime: serviceTimeSummary(church.serviceTimes),
    distanceKm: typeof church.distanceKm === "number" ? church.distanceKm : null,
  };
}

// What the model reads back: enough to judge fit. Lists carry no times or
// addresses to echo; a single named church carries its times so a question
// like "do they have an evening service?" can be answered.
function describeForModel(churches: ChurchResult[], options: { withTimes?: boolean } = {}): string {
  if (churches.length === 0) return "No churches found.";
  return JSON.stringify(
    churches.map((church) => ({
      name: church.name,
      place: [church.location, church.country].filter(Boolean).join(", ") || null,
      denomination: church.denomination,
      worship_styles: church.worshipStyles,
      language: church.language,
      ...(options.withTimes
        ? {
            service_times: serviceTimeSlots(church.serviceTimes).map((slot) =>
              [slot.day, slot.time, slot.label].filter(Boolean).join(" "),
            ),
          }
        : { has_service_times: serviceTimeSlots(church.serviceTimes).length > 0 }),
      ...(typeof church.distanceKm === "number" ? { distance_km: church.distanceKm } : {}),
    })),
  );
}

function cleanReply(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*#_`>]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_REPLY_CHARS);
}

// Many city names exist in more than one country (Madrid, Spain and Madrid,
// Iowa). Keep the requested country when it matches anything.
function filterByCountry(churches: ChurchResult[], country: string | undefined): ChurchResult[] {
  if (!country) return churches;
  const wanted = country.toLowerCase();
  const aliases = new Set([wanted]);
  if (["usa", "us", "united states of america", "america"].includes(wanted)) aliases.add("united states");
  if (["uk", "england", "scotland", "wales", "great britain"].includes(wanted)) aliases.add("united kingdom");
  const matching = churches.filter((church) => aliases.has((church.country ?? "").toLowerCase()));
  return matching.length > 0 ? matching : churches;
}

// Put the churches the reply names first, so the text and the cards agree.
function orderByMention(cards: ChurchChatCard[], reply: string): ChurchChatCard[] {
  const text = reply.toLowerCase();
  return [...cards].sort(
    (a, b) => Number(text.includes(b.name.toLowerCase())) - Number(text.includes(a.name.toLowerCase())),
  );
}

type ToolOutcome = {
  result: Anthropic.Beta.BetaToolResultBlockParam;
  churches: ChurchResult[];
  guide?: ChurchChatGuide;
  searchHref?: string;
};

async function runTool(
  block: Anthropic.Beta.BetaToolUseBlock,
  request: ChurchChatRequest,
  deps: ChurchChatDeps,
): Promise<ToolOutcome> {
  const input = (block.input ?? {}) as Record<string, unknown>;
  const reply = (content: string, isError = false): Anthropic.Beta.BetaToolResultBlockParam => ({
    type: "tool_result",
    tool_use_id: block.id,
    content,
    ...(isError ? { is_error: true } : {}),
  });
  const filters = {
    worshipStyle: asString(input.worship_style),
    denomination: asString(input.denomination),
    language: asString(input.language),
  };

  try {
    if (block.name === "find_churches_in_city") {
      const requested = asString(input.city);
      if (!requested) return { result: reply("A city is required.", true), churches: [] };
      const [cityPart, ...rest] = requested.split(",");
      const city = cityPart?.trim() || requested;
      const country = asString(input.country) ?? (rest.join(",").trim() || undefined);
      let citySlug = slugify(city);
      let found = await deps.findChurchesInCity({ citySlug, limit: 20, ...filters });
      if (found.length === 0 && deps.resolveCitySlug) {
        // "Gothenburg" is stored as Göteborg, typos never match a slug: resolve like the site search does.
        const resolved = await deps.resolveCitySlug(city).catch(() => null);
        if (resolved && resolved !== citySlug) {
          citySlug = resolved;
          found = await deps.findChurchesInCity({ citySlug, limit: 20, ...filters });
        }
      }
      const churches = filterByCountry(found, country).slice(0, MAX_CARDS);
      return {
        result: reply(describeForModel(churches)),
        churches,
        searchHref: `/church?q=${encodeURIComponent(city)}`,
      };
    }

    if (block.name === "find_church_by_name") {
      const name = asString(input.name);
      if (!name) return { result: reply("A church name is required.", true), churches: [] };
      const city = asString(input.city);
      let suggestions = await deps.getChurchSearchSuggestions(city ? `${name} ${city}` : name, 5);
      if (city && !suggestions.some((s) => s.type === "church")) {
        suggestions = await deps.getChurchSearchSuggestions(name, 5);
      }
      const slugs = suggestions.flatMap((s) => (s.type === "church" ? [s.slug] : [])).slice(0, 3);
      const candidates = (await Promise.all(slugs.map((slug) => deps.getChurchProfile(slug)))).filter(
        (profile): profile is NonNullable<typeof profile> => Boolean(profile),
      );
      // A name lookup wants one church. Similar names elsewhere ("Victory
      // Bible Church" in three countries) only confuse the answer.
      const inCity = city
        ? candidates.filter((profile) => (profile.location ?? "").toLowerCase().includes(city.toLowerCase()))
        : [];
      const profiles = inCity.length > 0 ? inCity.slice(0, 2) : candidates.slice(0, 1);
      return {
        result: reply(describeForModel(profiles, { withTimes: true })),
        churches: profiles,
        searchHref: `/church?q=${encodeURIComponent(name)}`,
      };
    }

    if (block.name === "find_churches_near_user") {
      if (!request.location) {
        return { result: reply("The visitor has not shared a location. Ask which city.", true), churches: [] };
      }
      const churches = await deps.findChurchesNear({
        latitude: request.location.latitude,
        longitude: request.location.longitude,
        radiusKm: 30,
        limit: MAX_CARDS,
        ...filters,
      });
      return { result: reply(describeForModel(churches)), churches };
    }

    if (block.name === "show_guide") {
      const key = asString(input.guide);
      const guide = key ? CHURCH_CHAT_GUIDES[key] : undefined;
      if (!key || !guide) return { result: reply("Unknown guide.", true), churches: [] };
      return { result: reply("The guide link is shown under your answer."), churches: [], guide: { key, ...guide } };
    }

    return { result: reply(`Unknown tool ${block.name}.`, true), churches: [] };
  } catch {
    return { result: reply("The directory lookup failed. Say that you could not search right now.", true), churches: [] };
  }
}

const REFUSAL_REPLY = "I can help you find a church and plan a first visit. Try asking about a city, a worship style or a language.";

export async function answerChurchQuestion(
  request: ChurchChatRequest,
  deps: ChurchChatDeps,
): Promise<ChurchChatAnswer> {
  const messages: Anthropic.Beta.BetaMessageParam[] = request.messages.map((turn) => ({
    role: turn.role,
    content: turn.text,
  }));
  const tools = request.location ? [CITY_TOOL, NEAR_TOOL, NAME_TOOL, GUIDE_TOOL] : [CITY_TOOL, NAME_TOOL, GUIDE_TOOL];

  let cards: ChurchChatCard[] = [];
  let guide: ChurchChatGuide | null = null;
  let searchHref: string | null = null;

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const response = await deps.createMessage({
      model: CHURCH_CHAT_MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools,
      messages,
      output_config: { effort: "low" },
      betas: [FALLBACK_BETA],
      fallbacks: "default",
    });

    if (response.stop_reason === "refusal") {
      return { reply: REFUSAL_REPLY, churches: [], guide: null, searchHref: null };
    }

    const toolUses = response.content.filter(
      (block): block is Anthropic.Beta.BetaToolUseBlock => block.type === "tool_use",
    );

    if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
      const text = response.content
        .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
        .map((block) => block.text)
        .join(" ");
      const reply = cleanReply(text) || (cards.length ? "Here is what I found." : REFUSAL_REPLY);
      return { reply, churches: orderByMention(cards, reply), guide, searchHref };
    }

    // Append the assistant turn unchanged (thinking blocks included), then
    // every tool result in one user message.
    messages.push({ role: "assistant", content: response.content });
    const outcomes = await Promise.all(toolUses.map((block) => runTool(block, request, deps)));
    messages.push({ role: "user", content: outcomes.map((outcome) => outcome.result) });

    // Cards follow the latest round that found churches; parallel calls in one
    // round (two cities) are merged.
    const found = outcomes.flatMap((outcome) => outcome.churches);
    if (found.length > 0) {
      const seen = new Set<string>();
      cards = found
        .filter((church) => (seen.has(church.slug) ? false : (seen.add(church.slug), true)))
        .slice(0, MAX_CARDS)
        .map(toChatCard);
    }
    guide = outcomes.find((outcome) => outcome.guide)?.guide ?? guide;
    searchHref = outcomes.find((outcome) => outcome.searchHref)?.searchHref ?? searchHref;
  }

  return {
    reply: cards.length ? "Here is what I found." : REFUSAL_REPLY,
    churches: cards,
    guide,
    searchHref,
  };
}
