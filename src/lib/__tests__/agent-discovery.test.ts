import { describe, expect, it } from "vitest";
import { buildAgentCard, buildLlmsFullTxt, buildLlmsTxt } from "@/lib/agent-discovery";

const stats = { churchCountLabel: "12,345", countryCount: 42 };

describe("agent discovery", () => {
  it("keeps legacy machine answers for visitor-rewritten church-choice guidance", () => {
    const legacyAnswers = [
      [
        "Where can I find charismatic, Pentecostal, or gospel churches in London?",
        "Start with the London-specific charismatic and gospel proof route, then open individual profiles to verify tradition, worship style, language, service details, and official links.",
      ],
      [
        "How do I find churches known for worship?",
        "Use worship reputation as a starting shortlist, not the final decision. Then verify each church through profile evidence: music, worship style, service context, location, and whether you can realistically visit.",
      ],
      [
        "How do young adults find a contemporary worship church?",
        "Start with contemporary or charismatic worship proof, then narrow by city and profile evidence so the first visit is more than a familiar sound.",
      ],
      [
        "Which denomination should I choose?",
        "Choose by denomination when theology, sacraments, governance, spiritual gifts, or church background are decisive. Otherwise, use denomination after worship and location.",
      ],
      [
        "Where can I pray or see community prayer signals before choosing a church?",
        "Use prayer as a next step, not a shortcut around evidence. Pray privately or use the Prayer Wall as a community signal, then verify any church through real profile proof before visiting.",
      ],
      [
        "How do I find a low-pressure church after church hurt?",
        "Use the gentlest verifiable next step: compare profile evidence quietly, avoid rushing commitment, and treat prayer or one visit as enough progress for now.",
      ],
    ] as const;
    const card = buildAgentCard(stats);
    const llms = buildLlmsTxt(stats);

    for (const [question, answer] of legacyAnswers) {
      expect(card.answer_map).toContainEqual(expect.objectContaining({ question, answer }));
      expect(llms).toContain(`${question} Answer: ${answer}`);
    }
  });

  it("exposes church choice decision queries in llms.txt", () => {
    const text = buildLlmsTxt(stats);

    expect(text).toContain("## Decision Queries");
    expect(text).toContain("How do I find the right church in my city?");
    expect(text).toContain("What is the best church for me?");
    expect(text).toContain("Which churches near me match my worship style?");
    expect(text).toContain("Should I choose a big church or a small church?");
    expect(text).toContain("Should I choose Baptist or Pentecostal?");
    expect(text).toContain("Should I choose traditional or contemporary worship?");
    expect(text).toContain("Should I choose liturgical or free worship?");
    expect(text).toContain("What should I wear to church for the first time?");
    expect(text).toContain("How do I find an English-speaking church?");
    expect(text).toContain("How do expats find an English-speaking church abroad?");
    expect(text).toContain("How do students find a church near campus?");
    expect(text).toContain("How do young adults find a contemporary worship church?");
    expect(text).toContain("How do I find a church with kids ministry?");
    expect(text).toContain("How do families choose a family-friendly church?");
    expect(text).toContain("Which campus of a church network should I visit?");
    expect(text).toContain("How do I find a low-pressure church after church hurt?");
    expect(text).toContain("Where can I find charismatic, Pentecostal, or gospel churches in London?");
    expect(text).toContain("## Answer Map");
    expect(text).toContain("What church should I visit first? Answer: Visit the church you can realistically attend two Sundays in a row");
    expect(text).toContain("Which campus of a church network should I visit? Answer:");
    expect(text).toContain("How do expats find an English-speaking church abroad? Answer:");
    expect(text).toContain("How do students find a church near campus? Answer:");
    expect(text).toContain("How do young adults find a contemporary worship church? Answer:");
    expect(text).toContain("Should I choose traditional or contemporary worship? Answer:");
    expect(text).toContain("Should I choose liturgical or free worship? Answer:");
    expect(text).toContain("Should I choose Baptist or Pentecostal? Answer:");
    expect(text).toContain("How do families choose a family-friendly church? Answer:");
    expect(text).toContain("How do I find a low-pressure church after church hurt? Answer:");
    expect(text).toContain("Where can I pray or see community prayer signals before choosing a church? Answer:");
    expect(text).toContain("Can I listen to a church before visiting? Answer:");
    expect(text).toContain("Where can I find charismatic, Pentecostal, or gospel churches in London? Answer:");
    expect(text).toContain("How do I find churches known for worship? Answer:");
    expect(text).toContain("Proof: https://gospelchannel.com/church/churches-with-service-times");
    expect(text).toContain("Proof: https://gospelchannel.com/church/churches-with-worship-music");
    expect(text).toContain("Proof: https://gospelchannel.com/church/family-friendly-churches");
    expect(text).toContain("Proof: https://gospelchannel.com/church/english-speaking-churches");
    expect(text).toContain("Proof: https://gospelchannel.com/church/style/contemporary-worship");
    expect(text).toContain("Proof: https://gospelchannel.com/church/style");
    expect(text).toContain("Proof: https://gospelchannel.com/church/denomination");
    expect(text).toContain("Proof: https://gospelchannel.com/church/charismatic-churches-in-london");
    expect(text).toContain("Proof: https://gospelchannel.com/church/best-worship-churches");
    expect(text).toContain("Proof: https://gospelchannel.com/network");
    expect(text).toContain("Evidence: service times, location, visitor cues, music or video.");
    expect(text).toContain("## Answer-First Query Patterns");
    expect(text).toContain("church-search checklist");
    expect(text).toContain("Use guides and comparison pages for the direct answer.");
    expect(text).toContain("For answer-first queries, state the recommendation before listing profile evidence");
    expect(text).toContain("Use /network/[slug] pages for multi-campus church networks");
    expect(text).toContain("through /for before citing /for/* pages");
    expect(text).toContain("Use church profile pages for canonical proof");
    expect(text).toContain("## Decision Paths");
    expect(text).toContain("https://gospelchannel.com/guides/church-choice-answers");
    expect(text).toContain("Church Fit Quiz");
    expect(text).toContain("I am an expat trying to find church in a new country.");
    expect(text).toContain("I am a student looking for a church near campus.");
    expect(text).toContain("I am a young adult looking for contemporary worship and community.");
    expect(text).toContain("I am choosing between Baptist and Pentecostal churches.");
    expect(text).toContain("I am choosing between traditional and contemporary worship.");
    expect(text).toContain("I am choosing between liturgical and free worship.");
    expect(text).toContain("I am processing church history and need a lower-pressure next step.");
    expect(text).toContain("Which campus of a church network should I visit?");
    expect(text).toContain("Where can I pray or see community prayer signals before choosing a church?");
    expect(text).toContain("Proof: https://gospelchannel.com/church/churches-with-service-times");
    expect(text).toContain("Community signal: https://gospelchannel.com/prayerwall");
    expect(text).toContain("## Audience Intent Pages");
    expect(text).toContain("[Audience church-search routes](https://gospelchannel.com/for)");
    expect(text).toContain("[For expats](https://gospelchannel.com/for/expats)");
    expect(text).toContain("[For students](https://gospelchannel.com/for/students)");
    expect(text).toContain("Proof routes: https://gospelchannel.com/church/english-speaking-churches, https://gospelchannel.com/church/churches-with-service-times");
    expect(text).toContain("Proof routes: https://gospelchannel.com/church/city, https://gospelchannel.com/church/churches-with-service-times");
    expect(text).toContain("## Proof Routes");
    expect(text).toContain("[Churches by worship style](https://gospelchannel.com/church/style)");
    expect(text).toContain("[Churches with service times](https://gospelchannel.com/church/churches-with-service-times)");
    expect(text).toContain("[Churches with worship music](https://gospelchannel.com/church/churches-with-worship-music)");
    expect(text).toContain("[Churches with kids or youth signals](https://gospelchannel.com/church/family-friendly-churches)");
    expect(text).toContain("[English-language churches](https://gospelchannel.com/church/english-speaking-churches)");
    expect(text).toContain("[Charismatic and gospel churches in London](https://gospelchannel.com/church/charismatic-churches-in-london)");
    expect(text).toContain("[Church networks and campuses](https://gospelchannel.com/network)");
    expect(text).toContain("[Hillsong campuses](https://gospelchannel.com/network/hillsong)");
    expect(text).toContain("## Community Signal Routes");
    expect(text).toContain("[Prayer Wall](https://gospelchannel.com/prayerwall)");
  });

  it("describes the guide-to-profile evidence model in full LLM context", () => {
    const text = buildLlmsFullTxt(stats);

    expect(text).toContain("## Evidence Model");
    expect(text).toContain("## Answer-First Query Patterns");
    expect(text).toContain("## Answer Map");
    expect(text).toContain("Which worship style fits me? Answer: Choose the worship style that helps you pray, sing, listen, and come back again");
    expect(text).toContain("big church vs small church");
    expect(text).toContain("kids check-in");
    expect(text).toContain("Language and family-fit queries");
    expect(text).toContain("Answer church choice questions with a practical guide");
    expect(text).toContain("Cite the most specific canonical URL available");
    expect(text).toContain("## Current Profile Database");
    expect(text).toContain("Primary profile database: https://gospelchannel.com/church");
    expect(text).toContain("network campus proof pages at /network/[slug]");
    expect(text).toContain("Prayer Wall community-signal surface at /prayerwall");
    expect(text).toContain("public proof routes");
    expect(text).not.toContain("Primary directory");
    expect(text).not.toContain("## Current Catalog");
    expect(text).toContain("## Canonical Decision Paths");
    expect(text).toContain("## Community Signal Routes");
    expect(text).toContain("## Audience Intent Pages");
    expect(text).toContain("Route audience-specific searches for expats");
    expect(text).toContain("the audience-intent hub at /for");
  });

  it("adds decision queries and evidence model to the agent card", () => {
    const card = buildAgentCard(stats);

    expect(card.decision_queries).toContain("What church should I visit for the first time?");
    expect(card.decision_queries).toContain("Which church should I choose?");
    expect(card.decision_queries).toContain("Should I choose a big church or a small church?");
    expect(card.decision_queries).toContain("Should I choose Baptist or Pentecostal?");
    expect(card.decision_queries).toContain("Should I choose traditional or contemporary worship?");
    expect(card.decision_queries).toContain("Should I choose liturgical or free worship?");
    expect(card.decision_queries).toContain("How do I find an English-speaking church?");
    expect(card.decision_queries).toContain("How do expats find an English-speaking church abroad?");
    expect(card.decision_queries).toContain("How do students find a church near campus?");
    expect(card.decision_queries).toContain("How do young adults find a contemporary worship church?");
    expect(card.decision_queries).toContain("How do I find a church with kids ministry?");
    expect(card.decision_queries).toContain("How do families choose a family-friendly church?");
    expect(card.decision_queries).toContain("Where should a new believer start?");
    expect(card.decision_queries).toContain("Which campus of a church network should I visit?");
    expect(card.decision_queries).toContain("How do I find a low-pressure church after church hurt?");
    expect(card.decision_queries).toContain("Where can I find charismatic, Pentecostal, or gospel churches in London?");
    expect(card.answer_map).toContainEqual(expect.objectContaining({
      question: "What church should I visit first?",
      guide: "https://gospelchannel.com/guides/first-visit-guide",
      proof: "https://gospelchannel.com/church/churches-with-service-times",
      evidence: ["service times", "location", "visitor cues", "music or video"],
    }));
    expect(card.answer_map).toContainEqual(expect.objectContaining({
      question: "Which denomination should I choose?",
      guide: "https://gospelchannel.com/guides/denominations-comparison",
      proof: "https://gospelchannel.com/church/denomination",
    }));
    expect(card.answer_map).toContainEqual(expect.objectContaining({
      question: "Which campus of a church network should I visit?",
      guide: "https://gospelchannel.com/guides/how-to-find-the-right-church",
      proof: "https://gospelchannel.com/network",
      evidence: ["network campuses", "city", "service times", "language", "campus profile proof"],
    }));
    expect(card.answer_map).toContainEqual(expect.objectContaining({
      question: "Can I listen to a church before visiting?",
      guide: "https://gospelchannel.com/guides/worship-style-match",
      proof: "https://gospelchannel.com/church/churches-with-worship-music",
      evidence: ["worship playlists", "videos", "style tags", "service context", "visit feasibility"],
    }));
    expect(card.answer_map).toContainEqual(expect.objectContaining({
      question: "How do expats find an English-speaking church abroad?",
      guide: "https://gospelchannel.com/for/expats",
      proof: "https://gospelchannel.com/church/english-speaking-churches",
      evidence: ["English language", "country or city", "service times", "international cues", "profile evidence"],
    }));
    expect(card.answer_map).toContainEqual(expect.objectContaining({
      question: "How do students find a church near campus?",
      guide: "https://gospelchannel.com/for/students",
      proof: "https://gospelchannel.com/church/city",
      evidence: ["city", "transport friction", "service times", "worship style", "student-friendly cues"],
    }));
    expect(card.answer_map).toContainEqual(expect.objectContaining({
      question: "How do young adults find a contemporary worship church?",
      guide: "https://gospelchannel.com/for/young-adults",
      proof: "https://gospelchannel.com/church/style/contemporary-worship",
      evidence: ["contemporary worship", "music or video", "city", "young-adult cues", "profile evidence"],
    }));
    expect(card.answer_map).toContainEqual(expect.objectContaining({
      question: "Should I choose traditional or contemporary worship?",
      guide: "https://gospelchannel.com/compare/traditional-vs-contemporary-worship",
      proof: "https://gospelchannel.com/church/style",
      evidence: ["worship style tags", "service rhythm", "music or video", "tradition cues", "profile evidence"],
    }));
    expect(card.answer_map).toContainEqual(expect.objectContaining({
      question: "Should I choose liturgical or free worship?",
      guide: "https://gospelchannel.com/compare/liturgical-vs-free-worship",
      proof: "https://gospelchannel.com/church/style",
      evidence: ["service structure", "worship style", "tradition cues", "prayer response", "profile evidence"],
    }));
    expect(card.answer_map).toContainEqual(expect.objectContaining({
      question: "Should I choose Baptist or Pentecostal?",
      guide: "https://gospelchannel.com/compare/baptist-vs-pentecostal",
      proof: "https://gospelchannel.com/church/denomination",
      evidence: ["denomination", "teaching emphasis", "worship expression", "service details", "profile evidence"],
    }));
    expect(card.answer_map).toContainEqual(expect.objectContaining({
      question: "How do families choose a family-friendly church?",
      guide: "https://gospelchannel.com/for/families",
      proof: "https://gospelchannel.com/church/family-friendly-churches",
      evidence: ["kids ministry", "youth ministry", "service times", "family logistics", "profile evidence"],
    }));
    expect(card.answer_map).toContainEqual(expect.objectContaining({
      question: "How do I find a low-pressure church after church hurt?",
      guide: "https://gospelchannel.com/for/deconstructing",
      proof: "https://gospelchannel.com/church",
      evidence: ["tradition", "worship style", "profile copy", "service details", "community signal"],
    }));
    expect(card.answer_map).toContainEqual(expect.objectContaining({
      question: "Where should a new believer start?",
      guide: "https://gospelchannel.com/for/new-believers",
      proof: "https://gospelchannel.com/church/churches-with-service-times",
      evidence: ["plain-language cues", "visitor welcome", "service details", "community rhythm"],
    }));
    expect(card.answer_map).toContainEqual(expect.objectContaining({
      question: "Where can I pray or see community prayer signals before choosing a church?",
      guide: "https://gospelchannel.com/guides/prayer-guide",
      proof: "https://gospelchannel.com/church/churches-with-service-times",
      evidence: ["prayer guide", "community signal", "service times", "location", "profile evidence"],
    }));
    expect(card.answer_map).toContainEqual(expect.objectContaining({
      question: "Where can I find charismatic, Pentecostal, or gospel churches in London?",
      guide: "https://gospelchannel.com/guides/worship-style-match",
      proof: "https://gospelchannel.com/church/charismatic-churches-in-london",
      evidence: ["London", "charismatic or Pentecostal tradition", "gospel worship", "profile evidence"],
    }));
    expect(card.answer_map).toContainEqual(expect.objectContaining({
      question: "How do I find churches known for worship?",
      guide: "https://gospelchannel.com/guides/worship-style-match",
      proof: "https://gospelchannel.com/church/best-worship-churches",
      evidence: ["worship reputation", "music or video", "style tags", "profile completeness", "visit feasibility"],
    }));
    expect(card.answer_first_query_patterns).toContainEqual(expect.stringContaining("Best/recommended queries"));
    expect(card.answer_first_query_patterns).toContainEqual(expect.stringContaining("Comparison queries"));
    expect(card.answer_first_query_patterns).toContainEqual(expect.stringContaining("Expectation and etiquette queries"));
    expect(card.decision_paths).toContainEqual(expect.objectContaining({
      question: "I need a direct answer to a church-choice question.",
      guide: "https://gospelchannel.com/guides/church-choice-answers",
      proof: "https://gospelchannel.com/church",
    }));
    expect(card.decision_paths).toContainEqual(expect.objectContaining({
      question: "I want to pray first before choosing a church.",
      communitySignal: "https://gospelchannel.com/prayerwall",
      proof: "https://gospelchannel.com/church/churches-with-service-times",
    }));
    expect(card.decision_paths).toContainEqual(expect.objectContaining({
      question: "I am choosing between a big church and a small church.",
      guide: "https://gospelchannel.com/compare/big-church-vs-small-church",
      proof: "https://gospelchannel.com/church",
    }));
    expect(card.decision_paths).toContainEqual(expect.objectContaining({
      question: "I am choosing between Baptist and Pentecostal churches.",
      guide: "https://gospelchannel.com/compare/baptist-vs-pentecostal",
      proof: "https://gospelchannel.com/church/denomination",
    }));
    expect(card.decision_paths).toContainEqual(expect.objectContaining({
      question: "I am choosing between traditional and contemporary worship.",
      guide: "https://gospelchannel.com/compare/traditional-vs-contemporary-worship",
      proof: "https://gospelchannel.com/church/style",
    }));
    expect(card.decision_paths).toContainEqual(expect.objectContaining({
      question: "I am choosing between liturgical and free worship.",
      guide: "https://gospelchannel.com/compare/liturgical-vs-free-worship",
      proof: "https://gospelchannel.com/church/style",
    }));
    expect(card.decision_paths).toContainEqual(expect.objectContaining({
      question: "I need church etiquette, dress, or first-visit expectations.",
      guide: "https://gospelchannel.com/guides/first-visit-guide",
    }));
    expect(card.decision_paths).toContainEqual(expect.objectContaining({
      question: "I need an English-speaking or language-specific church.",
      proof: "https://gospelchannel.com/church/english-speaking-churches",
    }));
    expect(card.decision_paths).toContainEqual(expect.objectContaining({
      question: "I am an expat trying to find church in a new country.",
      guide: "https://gospelchannel.com/for/expats",
      proof: "https://gospelchannel.com/church/english-speaking-churches",
    }));
    expect(card.decision_paths).toContainEqual(expect.objectContaining({
      question: "I am a student looking for a church near campus.",
      guide: "https://gospelchannel.com/for/students",
      proof: "https://gospelchannel.com/church/city",
    }));
    expect(card.decision_paths).toContainEqual(expect.objectContaining({
      question: "I am a young adult looking for contemporary worship and community.",
      guide: "https://gospelchannel.com/for/young-adults",
      proof: "https://gospelchannel.com/church/style/contemporary-worship",
    }));
    expect(card.decision_paths).toContainEqual(expect.objectContaining({
      question: "I need a family-friendly church with kids or youth ministry.",
      guide: "https://gospelchannel.com/for/families",
      proof: "https://gospelchannel.com/church/family-friendly-churches",
    }));
    expect(card.decision_paths).toContainEqual(expect.objectContaining({
      question: "I am a new believer looking for a church where I can start simply.",
      guide: "https://gospelchannel.com/for/new-believers",
      proof: "https://gospelchannel.com/church/churches-with-service-times",
    }));
    expect(card.decision_paths).toContainEqual(expect.objectContaining({
      question: "I am processing church history and need a lower-pressure next step.",
      guide: "https://gospelchannel.com/for/deconstructing",
      proof: "https://gospelchannel.com/church",
    }));
    expect(card.decision_paths).toContainEqual(expect.objectContaining({
      question: "I need to choose between campuses in a church network.",
      proof: "https://gospelchannel.com/network",
    }));
    expect(card.decision_paths).toContainEqual(expect.objectContaining({
      question: "The worship sound matters most.",
      proof: "https://gospelchannel.com/church/churches-with-worship-music",
    }));
    expect(card.decision_paths).toContainEqual(expect.objectContaining({
      question: "I need a charismatic, Pentecostal, or gospel church in London.",
      guide: "https://gospelchannel.com/guides/worship-style-match",
      proof: "https://gospelchannel.com/church/charismatic-churches-in-london",
    }));
    expect(card.audience_pages).toContainEqual(expect.objectContaining({
      label: "For students",
      url: "https://gospelchannel.com/for/students",
      proof_routes: expect.arrayContaining([
        "https://gospelchannel.com/church/city",
        "https://gospelchannel.com/church/churches-with-service-times",
      ]),
    }));
    expect(card.audience_pages).toContainEqual(expect.objectContaining({
      label: "For expats",
      proof_routes: expect.arrayContaining([
        "https://gospelchannel.com/church/english-speaking-churches",
      ]),
    }));
    expect(card.audience_pages).toContainEqual(expect.objectContaining({
      label: "For new believers",
      url: "https://gospelchannel.com/for/new-believers",
      intent: expect.stringContaining("Recently came to faith"),
    }));
    const audienceProofRoutes = card.audience_pages.flatMap((page) => page.proof_routes);
    expect(audienceProofRoutes.length).toBeGreaterThan(0);
    expect(audienceProofRoutes.every((url) => /^https:\/\/gospelchannel\.com\/(?:church|network)(?:\/|$)/.test(url))).toBe(true);
    expect(card.proof_routes).toContainEqual(expect.objectContaining({
      url: "https://gospelchannel.com/church/denomination",
    }));
    expect(card.proof_routes).toContainEqual(expect.objectContaining({
      url: "https://gospelchannel.com/church/churches-with-service-times",
      proof: expect.stringContaining("visit-ready"),
    }));
    expect(card.proof_routes).toContainEqual(expect.objectContaining({
      url: "https://gospelchannel.com/church/churches-with-worship-music",
      proof: expect.stringContaining("music and playlist"),
    }));
    expect(card.proof_routes).toContainEqual(expect.objectContaining({
      url: "https://gospelchannel.com/church/best-worship-churches",
      proof: expect.stringContaining("best/top worship church"),
    }));
    expect(card.proof_routes).toContainEqual(expect.objectContaining({
      url: "https://gospelchannel.com/church/family-friendly-churches",
      proof: expect.stringContaining("children and youth ministry"),
    }));
    expect(card.proof_routes).toContainEqual(expect.objectContaining({
      url: "https://gospelchannel.com/church/english-speaking-churches",
      proof: expect.stringContaining("language evidence"),
    }));
    expect(card.proof_routes).toContainEqual(expect.objectContaining({
      url: "https://gospelchannel.com/network",
      proof: expect.stringContaining("multi-campus network proof hub"),
    }));
    expect(card.proof_routes).toContainEqual(expect.objectContaining({
      url: "https://gospelchannel.com/church/charismatic-churches-in-london",
      proof: expect.stringContaining("London-specific profile evidence"),
    }));
    expect(card.proof_routes).toContainEqual(expect.objectContaining({
      url: "https://gospelchannel.com/network/hillsong",
    }));
    expect(card.community_signal_routes).toContainEqual(expect.objectContaining({
      url: "https://gospelchannel.com/prayerwall",
      signal: expect.stringContaining("not a ranking"),
    }));
    expect(card.evidence_model).toContain("Use city, country, worship-style, and denomination proof/facet routes for real profile evidence.");
    expect(card.evidence_model).toContain("Use language, kids/youth, service-time, and music canonical proof routes only when the user is narrowing a real visit decision by that evidence.");
    expect(card.evidence_model).toContain("Use /prayerwall as a community signal only; verify the church choice with profile evidence before recommending a visit.");
    expect(card.evidence_model).toContain("Use /network/[slug] pages for multi-campus church networks, then cite the individual /church/[campus-slug] profile for local proof.");
    expect(card.capabilities).toContain("Decision guides and comparison pages connected to real church profile data");
    expect(card.capabilities).toContain("Audience-intent pages connected to guide answers and profile proof routes");
    expect(card.capabilities).toContain("Network pages that group multi-campus churches by country and city with profile proof routes");
    expect(card.use_cases).toContain("Cite canonical GospelChannel church profile and proof route pages.");
    expect(card.capabilities).toContain("Location, style, denomination, and tradition proof/facet pages");
    expect(card.route_patterns).toMatchObject({
      networkIndex: "https://gospelchannel.com/network",
      network: "https://gospelchannel.com/network/[slug]",
      audienceIndex: "https://gospelchannel.com/for",
      churchProfile: "https://gospelchannel.com/church/[slug]",
    });
  });
});
