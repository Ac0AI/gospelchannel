import { describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import type { ChurchResult } from "@/lib/mcp/church-queries";
import { answerChurchQuestion, CHURCH_CHAT_MODEL, type ChurchChatDeps } from "../answer";
import { parseChurchChatRequest } from "../request";

vi.mock("@/lib/mcp/church-queries", () => ({
  findChurchesInCity: vi.fn(),
  findChurchesNear: vi.fn(),
  getChurchProfile: vi.fn(),
}));
vi.mock("@/lib/search-suggestions", () => ({ getChurchSearchSuggestions: vi.fn() }));

const MADRID_CHURCH: ChurchResult = {
  slug: "hillsong-madrid",
  name: "Hillsong Madrid",
  url: "https://gospelchannel.com/church/hillsong-madrid",
  location: "Madrid",
  country: "Spain",
  denomination: "Pentecostal",
  worshipStyles: ["contemporary", "hillsong"],
  language: "English",
  website: null,
  imageUrl: null,
  summary: null,
  serviceTimes: [{ day: "Sunday", time: "11:00" }, { day: "Sunday", time: null }],
};

function message(content: unknown[], stop_reason: string): Anthropic.Beta.BetaMessage {
  return { id: "msg", type: "message", role: "assistant", model: CHURCH_CHAT_MODEL, content, stop_reason } as unknown as Anthropic.Beta.BetaMessage;
}

function makeDeps(responses: Anthropic.Beta.BetaMessage[]) {
  const calls: Array<Parameters<ChurchChatDeps["createMessage"]>[0]> = [];
  const deps: ChurchChatDeps = {
    createMessage: vi.fn(async (params) => {
      // Snapshot: the loop keeps appending to the same array.
      calls.push(structuredClone(params));
      const next = responses.shift();
      if (!next) throw new Error("no more responses");
      return next;
    }),
    findChurchesInCity: vi.fn(async () => [MADRID_CHURCH]),
    findChurchesNear: vi.fn(async () => []),
    getChurchProfile: vi.fn(async () => null),
    getChurchSearchSuggestions: vi.fn(async () => []),
  };
  return { deps, calls };
}

const QUESTION = { messages: [{ role: "user" as const, text: "English church in Madrid?" }], location: null };

describe("answerChurchQuestion", () => {
  it("builds cards from the directory and keeps times out of the model's view", async () => {
    const thinking = { type: "thinking", thinking: "", signature: "sig" };
    const toolUse = {
      type: "tool_use",
      id: "tu_1",
      name: "find_churches_in_city",
      input: { city: "Madrid, Spain", language: "English" },
    };
    const { deps, calls } = makeDeps([
      message([thinking, toolUse], "tool_use"),
      message([{ type: "text", text: "**Hillsong Madrid** has English services: https://example.com" }], "end_turn"),
    ]);

    const answer = await answerChurchQuestion(QUESTION, deps);

    expect(deps.findChurchesInCity).toHaveBeenCalledWith({ citySlug: "madrid", limit: 20, worshipStyle: undefined, denomination: undefined, language: "English" });
    expect(answer.churches).toEqual([
      {
        slug: "hillsong-madrid",
        name: "Hillsong Madrid",
        href: "/church/hillsong-madrid",
        place: "Madrid, Spain",
        denomination: "Pentecostal",
        styles: ["contemporary", "hillsong"],
        language: "English",
        serviceTime: "Sunday 11:00",
        distanceKm: null,
      },
    ]);
    expect(answer.reply).toBe("Hillsong Madrid has English services:");
    expect(answer.searchHref).toBe("/church?q=Madrid");

    // Second request carries the assistant turn unchanged and one tool result.
    const second = calls[1];
    expect(second.messages[1]).toEqual({ role: "assistant", content: [thinking, toolUse] });
    const results = second.messages[2].content as Anthropic.Beta.BetaToolResultBlockParam[];
    expect(results).toHaveLength(1);
    expect(String(results[0].content)).not.toContain("11:00");
    expect(String(results[0].content)).toContain('"has_service_times":true');

    expect(calls[0].model).toBe("claude-opus-5-5");
    expect(calls[0].fallbacks).toBe("default");
    expect(calls[0].output_config).toEqual({ effort: "low" });
  });

  it("keeps the requested country when a city name exists in several countries, and orders cards by the reply", async () => {
    const iowa: ChurchResult = { ...MADRID_CHURCH, slug: "grace-madrid-iowa", name: "Grace Church", country: "United States", language: "en" };
    const second: ChurchResult = { ...MADRID_CHURCH, slug: "iglesia-madrid", name: "Iglesia Centro", language: "es" };
    const { deps } = makeDeps([
      message([{ type: "tool_use", id: "tu_c", name: "find_churches_in_city", input: { city: "Madrid", country: "Spain" } }], "tool_use"),
      message([{ type: "text", text: "Iglesia Centro is the closest fit." }], "end_turn"),
    ]);
    deps.findChurchesInCity = vi.fn(async () => [iowa, MADRID_CHURCH, second]);
    const answer = await answerChurchQuestion(QUESTION, deps);
    expect(answer.churches.map((card) => card.slug)).toEqual(["iglesia-madrid", "hillsong-madrid"]);
    expect(answer.churches[0].language).toBe("Spanish");
  });

  it("returns only the named church, not look-alikes in other cities", async () => {
    const london: ChurchResult = { ...MADRID_CHURCH, slug: "victory-london", name: "Victory Bible Church", location: "London", country: "United Kingdom" };
    const pasadena: ChurchResult = { ...MADRID_CHURCH, slug: "victory-pasadena", name: "Victory Bible Church", location: "Pasadena", country: "United States" };
    const { deps } = makeDeps([
      message([{ type: "tool_use", id: "tu_n", name: "find_church_by_name", input: { name: "Victory Bible Church", city: "London" } }], "tool_use"),
      message([{ type: "text", text: "Here it is." }], "end_turn"),
    ]);
    deps.getChurchSearchSuggestions = vi.fn(async () => [
      { id: "1", type: "church" as const, title: "Victory Bible Church", slug: "victory-pasadena", href: "/church/victory-pasadena" },
      { id: "2", type: "church" as const, title: "Victory Bible Church", slug: "victory-london", href: "/church/victory-london" },
    ]);
    deps.getChurchProfile = vi.fn(async (slug: string) => ({ "victory-london": london, "victory-pasadena": pasadena })[slug] as never);
    const answer = await answerChurchQuestion(QUESTION, deps);
    expect(answer.churches.map((card) => card.slug)).toEqual(["victory-london"]);
    // A single named church gives the model its times to answer "when".
    const toolResult = (vi.mocked(deps.createMessage).mock.calls[1][0].messages[2].content as Anthropic.Beta.BetaToolResultBlockParam[])[0];
    expect(String(toolResult.content)).toContain('"service_times":["Sunday 11:00"]');
  });

  it("offers the near-me tool only when the visitor shared a location", async () => {
    const first = makeDeps([message([{ type: "text", text: "Which city?" }], "end_turn")]);
    await answerChurchQuestion(QUESTION, first.deps);
    expect(first.calls[0].tools?.map((tool) => ("name" in tool ? tool.name : ""))).not.toContain("find_churches_near_user");

    const second = makeDeps([message([{ type: "text", text: "Here you go." }], "end_turn")]);
    await answerChurchQuestion({ ...QUESTION, location: { latitude: 40.42, longitude: -3.7 } }, second.deps);
    expect(second.calls[0].tools?.map((tool) => ("name" in tool ? tool.name : ""))).toContain("find_churches_near_user");
  });

  it("returns a guide link the model chose, never a URL from its text", async () => {
    const { deps } = makeDeps([
      message([{ type: "tool_use", id: "tu_g", name: "show_guide", input: { guide: "first-visit" } }], "tool_use"),
      message([{ type: "text", text: "Most churches are relaxed about what you wear." }], "end_turn"),
    ]);
    const answer = await answerChurchQuestion(
      { messages: [{ role: "user", text: "What should I wear to church?" }], location: null },
      deps,
    );
    expect(answer.guide).toEqual({ key: "first-visit", title: "What to expect on a first visit", href: "/guides/first-visit-guide" });
    expect(answer.churches).toEqual([]);
  });

  it("resolves a misspelled city through the directory when the slug finds nothing", async () => {
    const toolUse = { type: "tool_use", id: "tu_1", name: "find_churches_in_city", input: { city: "Stokholm", worship_style: "charismatic" } };
    const { deps } = makeDeps([
      message([toolUse], "tool_use"),
      message([{ type: "text", text: "Here is one." }], "end_turn"),
    ]);
    deps.findChurchesInCity = vi.fn(async ({ citySlug }) => (citySlug === "stockholm" ? [MADRID_CHURCH] : []));
    deps.resolveCitySlug = vi.fn(async () => "stockholm");
    const answer = await answerChurchQuestion(
      { messages: [{ role: "user", text: "karismatiska kyrkor i stokholm" }], location: null },
      deps,
    );
    expect(deps.resolveCitySlug).toHaveBeenCalledWith("Stokholm");
    expect(deps.findChurchesInCity).toHaveBeenLastCalledWith(expect.objectContaining({ citySlug: "stockholm", worshipStyle: "charismatic" }));
    expect(answer.churches).toHaveLength(1);
  });

  it("answers a refusal with a plain line and no cards", async () => {
    const { deps } = makeDeps([message([], "refusal")]);
    const answer = await answerChurchQuestion(QUESTION, deps);
    expect(answer.churches).toEqual([]);
    expect(answer.reply).toMatch(/find a church/);
  });
});

describe("parseChurchChatRequest", () => {
  it("trims history, drops a leading assistant turn and rounds location", () => {
    const parsed = parseChurchChatRequest({
      messages: [
        { role: "assistant", text: "Hi" },
        { role: "user", text: "  English church in Madrid  " },
      ],
      location: { latitude: 40.416775, longitude: -3.70379 },
    });
    expect(parsed).toEqual({
      messages: [{ role: "user", text: "English church in Madrid" }],
      location: { latitude: 40.42, longitude: -3.7 },
    });
  });

  it("rejects malformed bodies and a conversation that does not end with the visitor", () => {
    expect(parseChurchChatRequest(null)).toBeNull();
    expect(parseChurchChatRequest({ messages: "hi" })).toBeNull();
    expect(parseChurchChatRequest({ messages: [{ role: "system", text: "x" }] })).toBeNull();
    expect(parseChurchChatRequest({ messages: [{ role: "user", text: "a" }, { role: "assistant", text: "b" }] })).toBeNull();
  });
});
