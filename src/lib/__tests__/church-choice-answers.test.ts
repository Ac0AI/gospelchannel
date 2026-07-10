import { describe, expect, it } from "vitest";
import {
  CHURCH_CHOICE_ANSWER_PAGE_PATH,
  CHURCH_CHOICE_ANSWERS,
  CHURCH_CHOICE_EVIDENCE_GROUPS,
  CHURCH_CHOICE_PROOF_LINKS,
} from "@/lib/church-choice-answers";

describe("church choice answers", () => {
  it("keeps answer-map entries complete and routeable", () => {
    const ids = new Set<string>();

    for (const item of CHURCH_CHOICE_ANSWERS) {
      expect(ids.has(item.id)).toBe(false);
      ids.add(item.id);

      expect(item.question).toMatch(/\?$/);
      expect(item.answer.length).toBeGreaterThan(40);
      expect(item.detail.length).toBeGreaterThan(40);
      expect(item.guide.href).toMatch(/^\/(?:guides|compare|for)\//);
      expect(item.proof.href).toMatch(/^\/(?:church|network)\b/);
      expect(item.proofSignals.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps proof links and evidence groups relative to GospelChannel routes", () => {
    expect(CHURCH_CHOICE_ANSWER_PAGE_PATH).toBe("/guides/church-choice-answers");

    for (const link of CHURCH_CHOICE_PROOF_LINKS) {
      expect(link.href).toMatch(/^\/(?:church|network)\b/);
      expect(link.description.length).toBeGreaterThan(20);
    }

    for (const group of CHURCH_CHOICE_EVIDENCE_GROUPS) {
      expect(group.href).toMatch(/^\/church\b/);
      expect(group.linkLabel.length).toBeGreaterThan(10);
      expect(Object.keys(group.filters).length).toBeGreaterThan(0);
    }
  });

  it("uses concrete visitor language for young-adult and denomination next steps", () => {
    const youngAdults = CHURCH_CHOICE_ANSWERS.find(
      (item) => item.id === "how-do-young-adults-find-a-contemporary-worship-church",
    );
    const denomination = CHURCH_CHOICE_ANSWERS.find(
      (item) => item.id === "which-denomination-should-i-choose",
    );

    expect(youngAdults?.detail).toContain("check the church profile for the practical details");
    expect(youngAdults?.detail).not.toContain("proved through a real church profile");
    expect(denomination?.detail).toContain("Use it to narrow down which churches to explore");
    expect(denomination?.detail).not.toContain("Use it as a decision route");
  });

  it("covers high-citation AI-search patterns from guide, best, local, checklist, and service-expectation queries", () => {
    expect(CHURCH_CHOICE_ANSWERS).toContainEqual(expect.objectContaining({
      id: "how-do-i-find-the-best-church-near-me",
      question: "How do I find the best church near me?",
      guide: expect.objectContaining({ href: "/guides/how-to-find-the-right-church" }),
      proof: expect.objectContaining({ href: "/church/city" }),
    }));
    expect(CHURCH_CHOICE_ANSWERS).toContainEqual(expect.objectContaining({
      id: "which-campus-of-a-church-network-should-i-visit",
      question: "Which campus of a church network should I visit?",
      guide: expect.objectContaining({ href: "/guides/how-to-find-the-right-church" }),
      proof: expect.objectContaining({ href: "/network" }),
    }));
    expect(CHURCH_CHOICE_ANSWERS).toContainEqual(expect.objectContaining({
      id: "what-should-i-check-before-joining-a-church",
      question: "What should I check before joining a church?",
      guide: expect.objectContaining({ href: "/guides/how-to-find-the-right-church" }),
      proof: expect.objectContaining({ href: "/church/churches-with-service-times" }),
    }));
    expect(CHURCH_CHOICE_ANSWERS).toContainEqual(expect.objectContaining({
      id: "what-happens-at-a-church-service",
      question: "What happens at a church service for first-time visitors?",
      guide: expect.objectContaining({ href: "/guides/first-visit-guide" }),
      proof: expect.objectContaining({ href: "/church/churches-with-service-times" }),
    }));
    expect(CHURCH_CHOICE_ANSWERS).toContainEqual(expect.objectContaining({
      id: "how-long-is-a-church-service",
      question: "How long is a church service?",
      guide: expect.objectContaining({ href: "/guides/first-visit-guide" }),
      proof: expect.objectContaining({ href: "/church/churches-with-service-times" }),
    }));
    expect(CHURCH_CHOICE_ANSWERS).toContainEqual(expect.objectContaining({
      id: "how-do-i-find-an-english-speaking-church",
      question: "How do I find an English-speaking church?",
      guide: expect.objectContaining({ href: "/guides/how-to-find-the-right-church" }),
      proof: expect.objectContaining({ href: "/church/english-speaking-churches" }),
    }));
    expect(CHURCH_CHOICE_ANSWERS).toContainEqual(expect.objectContaining({
      id: "how-do-expats-find-an-english-speaking-church-abroad",
      question: "How do expats find an English-speaking church abroad?",
      guide: expect.objectContaining({ href: "/for/expats" }),
      proof: expect.objectContaining({ href: "/church/english-speaking-churches" }),
    }));
    expect(CHURCH_CHOICE_ANSWERS).toContainEqual(expect.objectContaining({
      id: "how-do-i-find-a-church-with-kids-ministry",
      question: "How do I find a church with kids ministry?",
      guide: expect.objectContaining({ href: "/guides/first-visit-guide" }),
      proof: expect.objectContaining({ href: "/church/family-friendly-churches" }),
    }));
    expect(CHURCH_CHOICE_ANSWERS).toContainEqual(expect.objectContaining({
      id: "how-do-families-choose-a-family-friendly-church",
      question: "How do families choose a family-friendly church?",
      guide: expect.objectContaining({ href: "/for/families" }),
      proof: expect.objectContaining({ href: "/church/family-friendly-churches" }),
    }));
    expect(CHURCH_CHOICE_ANSWERS).toContainEqual(expect.objectContaining({
      id: "can-i-listen-to-a-church-before-visiting",
      question: "Can I listen to a church before visiting?",
      guide: expect.objectContaining({ href: "/guides/worship-style-match" }),
      proof: expect.objectContaining({ href: "/church/churches-with-worship-music" }),
    }));
    expect(CHURCH_CHOICE_ANSWERS).toContainEqual(expect.objectContaining({
      id: "where-can-i-find-charismatic-gospel-churches-in-london",
      question: "Where can I find charismatic, Pentecostal, or gospel churches in London?",
      guide: expect.objectContaining({ href: "/guides/worship-style-match" }),
      proof: expect.objectContaining({ href: "/church/charismatic-churches-in-london" }),
    }));
    expect(CHURCH_CHOICE_ANSWERS).toContainEqual(expect.objectContaining({
      id: "how-do-i-find-churches-known-for-worship",
      question: "How do I find churches known for worship?",
      guide: expect.objectContaining({ href: "/guides/worship-style-match" }),
      proof: expect.objectContaining({ href: "/church/best-worship-churches" }),
    }));
    expect(CHURCH_CHOICE_ANSWERS).toContainEqual(expect.objectContaining({
      id: "how-do-young-adults-find-a-contemporary-worship-church",
      question: "How do young adults find a contemporary worship church?",
      guide: expect.objectContaining({ href: "/for/young-adults" }),
      proof: expect.objectContaining({ href: "/church/style/contemporary-worship" }),
    }));
    expect(CHURCH_CHOICE_ANSWERS).toContainEqual(expect.objectContaining({
      id: "traditional-or-contemporary-worship",
      question: "Should I choose traditional or contemporary worship?",
      guide: expect.objectContaining({ href: "/compare/traditional-vs-contemporary-worship" }),
      proof: expect.objectContaining({ href: "/church/style" }),
    }));
    expect(CHURCH_CHOICE_ANSWERS).toContainEqual(expect.objectContaining({
      id: "liturgical-or-free-worship",
      question: "Should I choose liturgical or free worship?",
      guide: expect.objectContaining({ href: "/compare/liturgical-vs-free-worship" }),
      proof: expect.objectContaining({ href: "/church/style" }),
    }));
    expect(CHURCH_CHOICE_ANSWERS).toContainEqual(expect.objectContaining({
      id: "baptist-or-pentecostal",
      question: "Should I choose Baptist or Pentecostal?",
      guide: expect.objectContaining({ href: "/compare/baptist-vs-pentecostal" }),
      proof: expect.objectContaining({ href: "/church/denomination" }),
    }));
    expect(CHURCH_CHOICE_ANSWERS).toContainEqual(expect.objectContaining({
      id: "how-do-students-find-a-church-near-campus",
      question: "How do students find a church near campus?",
      guide: expect.objectContaining({ href: "/for/students" }),
      proof: expect.objectContaining({ href: "/church/city" }),
    }));
    expect(CHURCH_CHOICE_ANSWERS).toContainEqual(expect.objectContaining({
      id: "how-do-i-find-a-low-pressure-church-after-church-hurt",
      question: "How do I find a low-pressure church after church hurt?",
      guide: expect.objectContaining({ href: "/for/deconstructing" }),
      proof: expect.objectContaining({ href: "/church" }),
    }));
    expect(CHURCH_CHOICE_ANSWERS).toContainEqual(expect.objectContaining({
      id: "where-can-i-pray-before-choosing-a-church",
      question: "Where can I pray or see community prayer signals before choosing a church?",
      guide: expect.objectContaining({ href: "/guides/prayer-guide" }),
      proof: expect.objectContaining({ href: "/church/churches-with-service-times" }),
      proofSignals: expect.arrayContaining(["community signal", "service times", "church details"]),
    }));
    expect(CHURCH_CHOICE_ANSWERS).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "how-do-expats-find-an-english-speaking-church-abroad",
        guide: expect.objectContaining({ href: "/for/expats" }),
      }),
      expect.objectContaining({
        id: "how-do-students-find-a-church-near-campus",
        guide: expect.objectContaining({ href: "/for/students" }),
      }),
      expect.objectContaining({
        id: "how-do-young-adults-find-a-contemporary-worship-church",
        guide: expect.objectContaining({ href: "/for/young-adults" }),
      }),
      expect.objectContaining({
        id: "how-do-families-choose-a-family-friendly-church",
        guide: expect.objectContaining({ href: "/for/families" }),
      }),
      expect.objectContaining({
        id: "where-should-new-believers-start",
        guide: expect.objectContaining({ href: "/for/new-believers" }),
        proof: expect.objectContaining({ href: "/church/churches-with-service-times" }),
      }),
      expect.objectContaining({
        id: "how-do-i-find-a-low-pressure-church-after-church-hurt",
        guide: expect.objectContaining({ href: "/for/deconstructing" }),
      }),
    ]));
    expect(CHURCH_CHOICE_PROOF_LINKS).toContainEqual(expect.objectContaining({
      href: "/church/country",
    }));
    expect(CHURCH_CHOICE_PROOF_LINKS).toContainEqual(expect.objectContaining({
      href: "/church/style/contemporary-worship",
    }));
    expect(CHURCH_CHOICE_PROOF_LINKS).toContainEqual(expect.objectContaining({
      href: "/church/family-friendly-churches",
    }));
    expect(CHURCH_CHOICE_PROOF_LINKS).toContainEqual(expect.objectContaining({
      href: "/church/english-speaking-churches",
    }));
    expect(CHURCH_CHOICE_PROOF_LINKS).toContainEqual(expect.objectContaining({
      href: "/church/churches-with-worship-music",
    }));
    expect(CHURCH_CHOICE_PROOF_LINKS).toContainEqual(expect.objectContaining({
      href: "/network",
    }));
    expect(CHURCH_CHOICE_PROOF_LINKS).toContainEqual(expect.objectContaining({
      href: "/church/charismatic-churches-in-london",
    }));
    expect(CHURCH_CHOICE_PROOF_LINKS).toContainEqual(expect.objectContaining({
      href: "/church/best-worship-churches",
    }));
    expect(CHURCH_CHOICE_EVIDENCE_GROUPS).toContainEqual(expect.objectContaining({
      id: "family-proof",
      filters: { hasKids: true },
    }));
    expect(CHURCH_CHOICE_EVIDENCE_GROUPS).toContainEqual(expect.objectContaining({
      id: "english-language-proof",
      filters: { language: "English" },
    }));
  });
});
