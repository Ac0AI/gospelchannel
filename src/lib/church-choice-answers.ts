import type { ChurchDirectoryFilters } from "@/lib/church-directory";

export const CHURCH_CHOICE_ANSWER_PAGE_PATH = "/guides/church-choice-answers";
export const CHURCH_CHOICE_ANSWER_PAGE_URL = "https://gospelchannel.com/guides/church-choice-answers";
export const CHURCH_CHOICE_ANSWER_PAGE_TITLE = "Church Choice Answers - What Church Should I Visit?";
export const CHURCH_CHOICE_ANSWER_PAGE_DESCRIPTION =
  "Answer-first church choice guide for deciding what church to visit, how to compare worship style, denomination, size, service times, and profile proof.";

type ChurchChoiceLink = {
  href: string;
  label: string;
};

export type ChurchChoiceAnswer = {
  id: string;
  question: string;
  answer: string;
  detail: string;
  guide: ChurchChoiceLink;
  proof: ChurchChoiceLink;
  proofSignals: string[];
};

export type ChurchChoiceProofLink = ChurchChoiceLink & {
  description: string;
};

export type ChurchChoiceEvidenceGroup = {
  id: string;
  title: string;
  description: string;
  href: string;
  linkLabel: string;
  filters: Omit<ChurchDirectoryFilters, "query">;
};

export const CHURCH_CHOICE_ANSWERS = [
  {
    id: "what-church-should-i-visit-first",
    question: "What church should I visit first?",
    answer:
      "Visit the church you can realistically attend two Sundays in a row and where the worship style will not make it hard for you to participate.",
    detail:
      "Do not start with the most impressive church name. Start with visit friction: service time, city, transport, language, kids needs, and whether the worship room feels possible for you.",
    guide: { href: "/guides/first-visit-guide", label: "Read the first-visit guide" },
    proof: { href: "/church/churches-with-service-times", label: "Open profiles with service times" },
    proofSignals: ["service times", "location", "visitor cues", "music or video"],
  },
  {
    id: "how-do-i-find-the-right-church",
    question: "How do I find the right church?",
    answer:
      "Use a short sequence: name what you need, choose a worship lane, narrow by city, compare tradition only if it matters, then visit two or three churches.",
    detail:
      "Most searches drift because every filter feels equally important. The practical order is worship fit, realistic location, tradition or denomination, then individual profile evidence.",
    guide: { href: "/guides/how-to-find-the-right-church", label: "Follow the step-by-step guide" },
    proof: { href: "/church", label: "Compare church profiles" },
    proofSignals: ["worship style", "city", "denomination", "profile evidence"],
  },
  {
    id: "how-do-i-find-the-best-church-near-me",
    question: "How do I find the best church near me?",
    answer:
      "Treat best as the church you can actually visit, understand, participate in, and return to - not the church with the biggest name or broadest reputation.",
    detail:
      "Start with geography and service times, then narrow by worship style, language, tradition, kids needs, and profile evidence. A nearby church that fits your real Sunday is usually better than a famous church you will not attend consistently.",
    guide: { href: "/guides/how-to-find-the-right-church", label: "Follow the church-search guide" },
    proof: { href: "/church/city", label: "Browse churches by city" },
    proofSignals: ["city", "service times", "worship fit", "language", "visitor friction"],
  },
  {
    id: "which-campus-of-a-church-network-should-i-visit",
    question: "Which campus of a church network should I visit?",
    answer:
      "Choose the campus you can actually attend and verify locally, not just the network name you recognize. Shared worship identity helps, but the visit decision is campus-specific.",
    detail:
      "Use the network page to compare countries, cities, and campus links. Then open the local campus profile to verify address, service times, language, worship evidence, kids cues, and first-visit details before choosing a Sunday.",
    guide: { href: "/guides/how-to-find-the-right-church", label: "Use the church-search guide" },
    proof: { href: "/network", label: "Open church network proof" },
    proofSignals: ["network campuses", "city", "service times", "language", "campus profile proof"],
  },
  {
    id: "how-do-i-find-an-english-speaking-church",
    question: "How do I find an English-speaking church?",
    answer:
      "Start with language as a practical constraint, then narrow by country or city before comparing worship style and tradition.",
    detail:
      "For expats, students, and international families, language is not a soft preference. It decides whether you can follow the sermon, ask questions, understand kids check-in, and return without depending on translation every week.",
    guide: { href: "/guides/how-to-find-the-right-church", label: "Use the church-search guide" },
    proof: { href: "/church/english-speaking-churches", label: "Open English-language profile proof" },
    proofSignals: ["language", "country or city", "service times", "visitor cues"],
  },
  {
    id: "how-do-expats-find-an-english-speaking-church-abroad",
    question: "How do expats find an English-speaking church abroad?",
    answer:
      "Start with English-language proof, then narrow by country, city, worship style, and tradition before choosing a first Sunday.",
    detail:
      "For expats, the first decision is usually comprehension before preference. Use the expat guidance to frame the search, but require profile proof for language, country or city, service details, and whether the church is realistically visitable from your new home.",
    guide: { href: "/guides/how-to-find-the-right-church", label: "Use the expat search sequence" },
    proof: { href: "/church/english-speaking-churches", label: "Open English-language church proof" },
    proofSignals: ["English language", "country or city", "service times", "international cues", "profile evidence"],
  },
  {
    id: "how-do-i-find-a-church-with-kids-ministry",
    question: "How do I find a church with kids ministry?",
    answer:
      "Use kids or youth ministry as a proof filter after you know the city and visit time, then read the profile for specific age-group and first-visit details.",
    detail:
      "A family-friendly claim is too broad by itself. The useful proof is whether the church exposes children or youth ministry signals, service timing, visitor expectations, and enough profile detail to plan the first Sunday with kids.",
    guide: { href: "/guides/first-visit-guide", label: "Read the first-visit guide" },
    proof: { href: "/church/family-friendly-churches", label: "Open profiles with kids or youth signals" },
    proofSignals: ["kids ministry", "youth ministry", "service times", "first-visit details"],
  },
  {
    id: "how-do-families-choose-a-family-friendly-church",
    question: "How do families choose a family-friendly church?",
    answer:
      "Choose the church that is sustainable for the whole household: realistic travel, clear kids or youth signals, understandable service flow, and a worship room adults can still participate in.",
    detail:
      "Family fit is not only whether a church says it welcomes children. The proof is whether the profile exposes age-group ministry, service timing, first-visit expectations, location, and enough detail to plan the Sunday before loading everyone into the car.",
    guide: { href: "/guides/first-visit-guide", label: "Use the family first-visit guide" },
    proof: { href: "/church/family-friendly-churches", label: "Open family-ready profile proof" },
    proofSignals: ["kids ministry", "youth ministry", "service times", "family logistics", "profile evidence"],
  },
  {
    id: "which-worship-style-fits-me",
    question: "Which worship style fits me?",
    answer:
      "Choose the worship style that helps you pray, sing, listen, and come back again - not the style you think you are supposed to like.",
    detail:
      "Contemporary, charismatic, gospel, acoustic, liturgical, Latin, and African worship can all be faithful rooms. The right first route is the one that lowers the barrier to a second visit.",
    guide: { href: "/guides/worship-styles-explained", label: "Understand worship styles" },
    proof: { href: "/church/style", label: "Browse worship-style proof routes" },
    proofSignals: ["style tags", "playlists", "videos", "room feel"],
  },
  {
    id: "traditional-or-contemporary-worship",
    question: "Should I choose traditional or contemporary worship?",
    answer:
      "Choose traditional worship if structure, continuity, and steadier pacing help you trust the room. Choose contemporary worship if modern song language and a lower-friction first visit make you more likely to return.",
    detail:
      "This is a room-feel decision before it is a quality judgement. Use the comparison guide to name the tradeoff, then verify real churches by worship style, service shape, music, location, and whether the profile gives enough evidence for a first Sunday.",
    guide: { href: "/compare/traditional-vs-contemporary-worship", label: "Compare traditional and contemporary worship" },
    proof: { href: "/church/style", label: "Browse worship-style proof" },
    proofSignals: ["worship style tags", "service rhythm", "music or video", "tradition cues", "profile evidence"],
  },
  {
    id: "liturgical-or-free-worship",
    question: "Should I choose liturgical or free worship?",
    answer:
      "Choose liturgical worship if known structure helps you relax and participate. Choose freer worship if openness, response, and expressive prayer make the room easier to enter.",
    detail:
      "The better first visit is the one that lowers resistance to showing up again. Liturgical and freer worship rooms can both be warm or difficult, so use the compare guide first and then verify profiles for service shape, tradition, worship style, and visitor clarity.",
    guide: { href: "/compare/liturgical-vs-free-worship", label: "Compare liturgical and free worship" },
    proof: { href: "/church/style", label: "Browse worship-style proof" },
    proofSignals: ["service structure", "worship style", "tradition cues", "prayer response", "profile evidence"],
  },
  {
    id: "can-i-listen-to-a-church-before-visiting",
    question: "Can I listen to a church before visiting?",
    answer:
      "Yes - start with churches that expose public worship music, playlists, or videos, then use the profile to check whether the sound, service context, and location make sense for a first visit.",
    detail:
      "Hearing worship before Sunday is useful when music or room feel could decide whether you can participate. Do not treat a playlist as the whole church; use it as one proof signal alongside service details, tradition, language, and visit feasibility.",
    guide: { href: "/guides/worship-style-match", label: "Match the worship sound" },
    proof: { href: "/church/churches-with-worship-music", label: "Open profiles with worship music" },
    proofSignals: ["worship playlists", "videos", "style tags", "service context", "visit feasibility"],
  },
  {
    id: "where-can-i-find-charismatic-gospel-churches-in-london",
    question: "Where can I find charismatic, Pentecostal, or gospel churches in London?",
    answer:
      "Start with the London-specific charismatic and gospel proof route, then open individual profiles to verify tradition, worship style, language, service details, and official links.",
    detail:
      "A broad London search is too noisy because charismatic, Pentecostal, Vineyard, Elim, and gospel-worship churches may appear under different labels. Use the guide to name the worship fit, then require profile evidence before planning a visit.",
    guide: { href: "/guides/worship-style-match", label: "Clarify worship fit" },
    proof: { href: "/church/charismatic-churches-in-london", label: "Open London charismatic and gospel proof" },
    proofSignals: ["London", "charismatic or Pentecostal tradition", "gospel worship", "profile evidence"],
  },
  {
    id: "how-do-i-find-churches-known-for-worship",
    question: "How do I find churches known for worship?",
    answer:
      "Use worship reputation as a starting shortlist, not the final decision. Then verify each church through profile evidence: music, worship style, service context, location, and whether you can realistically visit.",
    detail:
      "A famous worship name can help discovery, but it does not prove fit. The safer path is to understand the worship sound you need, then use the best-worship proof route and individual profiles to check real evidence before visiting.",
    guide: { href: "/guides/worship-style-match", label: "Match worship fit first" },
    proof: { href: "/church/best-worship-churches", label: "Open best-worship profile proof" },
    proofSignals: ["worship reputation", "music or video", "style tags", "profile completeness", "visit feasibility"],
  },
  {
    id: "how-do-young-adults-find-a-contemporary-worship-church",
    question: "How do young adults find a contemporary worship church?",
    answer:
      "Start with contemporary or charismatic worship proof, then narrow by city and profile evidence so the first visit is more than a familiar sound.",
    detail:
      "Young-adult fit is often discovered through worship style, but it should be proved through a real church profile: music or video, service context, location, ministries, and whether the room looks like a place you can return to after the first Sunday.",
    guide: { href: "/guides/worship-style-match", label: "Match the contemporary worship fit" },
    proof: { href: "/church/style/contemporary-worship", label: "Open contemporary worship proof" },
    proofSignals: ["contemporary worship", "music or video", "city", "young-adult cues", "profile evidence"],
  },
  {
    id: "which-denomination-should-i-choose",
    question: "Which denomination should I choose?",
    answer:
      "Choose by denomination when theology, sacraments, governance, spiritual gifts, or church background are decisive. Otherwise, use denomination after worship and location.",
    detail:
      "A denomination label can be useful, but it does not prove Sunday fit by itself. Use it as a decision route, then verify actual churches through profiles.",
    guide: { href: "/guides/denominations-comparison", label: "Compare denominations" },
    proof: { href: "/church/denomination", label: "Browse denomination proof routes" },
    proofSignals: ["tradition", "teaching emphasis", "worship style", "service details"],
  },
  {
    id: "baptist-or-pentecostal",
    question: "Should I choose Baptist or Pentecostal?",
    answer:
      "Choose Baptist if grounded teaching, steadier room energy, and a stable weekly rhythm matter most. Choose Pentecostal if expressive worship, prayer response, and visible expectancy make faith easier to participate in.",
    detail:
      "Do not decide from the label alone. Baptist and Pentecostal churches vary widely by city and congregation, so use the comparison guide to understand the tradeoff and then verify actual profiles by denomination, worship style, service details, and visitor cues.",
    guide: { href: "/compare/baptist-vs-pentecostal", label: "Compare Baptist and Pentecostal" },
    proof: { href: "/church/denomination", label: "Browse denomination proof" },
    proofSignals: ["denomination", "teaching emphasis", "worship expression", "service details", "profile evidence"],
  },
  {
    id: "big-church-or-small-church",
    question: "Should I choose a big church or a small church?",
    answer:
      "Choose a bigger church if you need clearer programs, anonymity, and lots happening. Choose a smaller church if being known and participating sooner matters more.",
    detail:
      "This is not a quality ranking. It is a social and practical fit decision. Your season of life may make either room the wiser first visit.",
    guide: { href: "/compare/big-church-vs-small-church", label: "Compare big vs small church" },
    proof: { href: "/church", label: "Inspect profile evidence" },
    proofSignals: ["room size cues", "ministries", "service rhythm", "community signals"],
  },
  {
    id: "what-should-i-wear-to-church",
    question: "What should I wear to church for the first time?",
    answer:
      "Wear something respectful and comfortable enough that you can stop thinking about it. Most modern churches are more relaxed than first-time visitors expect.",
    detail:
      "The better question is what kind of room you are entering. A cathedral, gospel church, student service, and contemporary church plant can all feel different.",
    guide: { href: "/guides/first-visit-guide", label: "Check first-visit expectations" },
    proof: { href: "/church/churches-with-service-times", label: "Check visit-ready profiles" },
    proofSignals: ["service details", "photos", "visitor notes", "church style"],
  },
  {
    id: "what-happens-at-a-church-service",
    question: "What happens at a church service for first-time visitors?",
    answer:
      "Most services include welcome, worship music, prayer, a sermon, giving, and a closing moment. The exact order varies by tradition and worship style.",
    detail:
      "Use the first-visit guide for the normal sequence, then verify each church profile for service times, language, worship style, kids details, visitor notes, music, and video before you go.",
    guide: { href: "/guides/first-visit-guide", label: "Read what happens on Sunday" },
    proof: { href: "/church/churches-with-service-times", label: "Check service-ready profiles" },
    proofSignals: ["service times", "worship style", "visitor notes", "kids details", "music or video"],
  },
  {
    id: "how-long-is-a-church-service",
    question: "How long is a church service?",
    answer:
      "Many church services run about 60 to 90 minutes, but the safer answer is to check the specific church because tradition, worship style, communion, prayer, and kids handoff can change the timing.",
    detail:
      "A contemporary service, liturgical service, Pentecostal service, student gathering, and family-heavy Sunday can all feel different. Use service-time profile evidence before planning travel or childcare.",
    guide: { href: "/guides/first-visit-guide", label: "Check first-visit timing" },
    proof: { href: "/church/churches-with-service-times", label: "Open profiles with service times" },
    proofSignals: ["service times", "tradition", "worship style", "kids handoff", "location"],
  },
  {
    id: "what-should-i-check-before-joining-a-church",
    question: "What should I check before joining a church?",
    answer:
      "Check whether the church is visitable, teachable for you, spiritually coherent, and practically sustainable before you treat it as your church home.",
    detail:
      "Look for service times, location, worship style, denomination or tradition, language, kids or youth cues, visitor expectations, and whether the profile evidence matches what the guide or recommendation promised.",
    guide: { href: "/guides/how-to-find-the-right-church", label: "Use the church-search checklist" },
    proof: { href: "/church/churches-with-service-times", label: "Open visit-ready profiles" },
    proofSignals: ["service times", "location", "tradition", "kids or youth cues", "profile evidence"],
  },
  {
    id: "how-many-churches-should-i-visit",
    question: "How many churches should I visit before choosing one?",
    answer:
      "Visit two or three churches after you have written down your criteria. More than that usually creates comparison fatigue unless you are still learning the landscape.",
    detail:
      "A good shortlist beats a long tour. Use profiles to remove bad fits before Sunday, then let real visits answer the remaining questions.",
    guide: { href: "/guides/how-to-find-the-right-church", label: "Build a shortlist" },
    proof: { href: "/church/city", label: "Start with a city proof route" },
    proofSignals: ["city", "service time", "worship fit", "shortlist quality"],
  },
  {
    id: "where-can-i-pray-before-choosing-a-church",
    question: "Where can I pray or see community prayer signals before choosing a church?",
    answer:
      "Use prayer as a next step, not a shortcut around evidence. Pray privately or use the Prayer Wall as a community signal, then verify any church through real profile proof before visiting.",
    detail:
      "A prayer post can show spiritual life around a community, but it is not a score, endorsement, or replacement for profile evidence. Use the prayer guide to slow the decision down, then check service times, location, worship style, language, and visitor cues before choosing a Sunday.",
    guide: { href: "/guides/prayer-guide", label: "Use prayer before choosing" },
    proof: { href: "/church/churches-with-service-times", label: "Open service-ready profile proof" },
    proofSignals: ["prayer guide", "community signal", "service times", "location", "profile evidence"],
  },
  {
    id: "how-do-students-find-a-church-near-campus",
    question: "How do students find a church near campus?",
    answer:
      "Start with the university city, not a wide radius, then filter by worship style, language, service time, and whether the profile gives enough evidence to visit without a car.",
    detail:
      "Student church search is a logistics problem before it is a preference problem. A strong option is close enough to actually attend, familiar enough in worship to make the first visit possible, and clear enough in its profile that Sunday does not get postponed again.",
    guide: { href: "/guides/how-to-find-the-right-church", label: "Build a student shortlist" },
    proof: { href: "/church/city", label: "Open city church proof" },
    proofSignals: ["city", "transport friction", "service times", "worship style", "student-friendly cues"],
  },
  {
    id: "where-should-new-believers-start",
    question: "Where should a new believer start?",
    answer:
      "Start with a church that explains the basics plainly, makes a first visit low-pressure, and has enough public information that you know what you are walking into.",
    detail:
      "If prayer, baptism, salvation, or Bible questions are still new, choose a church where you can ask without needing insider language first.",
    guide: { href: "/guides/faith-faq", label: "Read common faith questions" },
    proof: { href: "/for/new-believers", label: "Open new-believer routes" },
    proofSignals: ["plain-language cues", "visitor welcome", "service details", "community rhythm"],
  },
  {
    id: "how-do-i-find-a-low-pressure-church-after-church-hurt",
    question: "How do I find a low-pressure church after church hurt?",
    answer:
      "Use the gentlest verifiable next step: compare profile evidence quietly, avoid rushing commitment, and treat prayer or one visit as enough progress for now.",
    detail:
      "After church hurt or deconstruction, the database should not force a verdict. Use guides for language and prayer, then inspect profiles for tradition, worship style, public expectations, service details, and enough transparency to decide whether a single visit is worth trying.",
    guide: { href: "/guides/faith-faq", label: "Use plain-language faith guidance" },
    proof: { href: "/church", label: "Open broad profile proof" },
    proofSignals: ["tradition", "worship style", "profile copy", "service details", "community signal"],
  },
] satisfies ChurchChoiceAnswer[];

export const CHURCH_CHOICE_PROOF_LINKS = [
  {
    href: "/church",
    label: "All church profiles",
    description: "Use the full profile database when the decision is still open.",
  },
  {
    href: "/church/city",
    label: "Churches by city",
    description: "Start here when the practical Sunday decision is geography.",
  },
  {
    href: "/church/country",
    label: "Churches by country",
    description: "Use this when expat, international, or relocation searches need country-level proof before city narrowing.",
  },
  {
    href: "/church/style",
    label: "Churches by worship style",
    description: "Use this when music, room feel, and participation are decisive.",
  },
  {
    href: "/church/style/contemporary-worship",
    label: "Contemporary worship proof",
    description: "Use this when young-adult or modern-worship searches need a specific style route before profile checks.",
  },
  {
    href: "/church/denomination",
    label: "Churches by denomination",
    description: "Use this when tradition, theology, or church background matters.",
  },
  {
    href: "/network",
    label: "Church network campus proof",
    description: "Use this when choosing between campuses inside a multi-campus church network.",
  },
  {
    href: "/church/churches-with-service-times",
    label: "Profiles with service times",
    description: "Use this when you are turning a shortlist into a real Sunday plan.",
  },
  {
    href: "/church/churches-with-worship-music",
    label: "Profiles with worship music",
    description: "Use this when you need to hear the worship sound before visiting.",
  },
  {
    href: "/church/best-worship-churches",
    label: "Best-worship profile proof",
    description: "Use this when reputation or recommendation language needs to be checked against profile evidence.",
  },
  {
    href: "/church/family-friendly-churches",
    label: "Profiles with kids or youth signals",
    description: "Use this when family logistics and age-group ministry are decisive before a first visit.",
  },
  {
    href: "/church/english-speaking-churches",
    label: "English-language profile proof",
    description: "Use this when language determines whether the church is realistically visitable.",
  },
  {
    href: "/church/charismatic-churches-in-london",
    label: "London charismatic and gospel proof",
    description: "Use this when the decision combines London geography with charismatic, Pentecostal, or gospel worship fit.",
  },
] satisfies ChurchChoiceProofLink[];

export const CHURCH_CHOICE_EVIDENCE_GROUPS = [
  {
    id: "visit-ready",
    title: "Visit-ready profile proof",
    description: "Churches with service-time evidence, useful when the answer needs to become a real Sunday plan.",
    href: "/church/churches-with-service-times",
    linkLabel: "Browse service-ready profiles",
    filters: { hasServiceTimes: true },
  },
  {
    id: "worship-proof",
    title: "Worship music proof",
    description: "Profiles with music signals so worship-style advice can be checked against actual church sound.",
    href: "/church/churches-with-worship-music",
    linkLabel: "Browse profiles with music",
    filters: { hasMusic: true },
  },
  {
    id: "tradition-proof",
    title: "Tradition proof examples",
    description: "Denomination-filtered profiles for decisions where theology family or church background matters.",
    href: "/church/denomination/evangelical",
    linkLabel: "Browse evangelical churches",
    filters: { denominationSlug: "evangelical" },
  },
  {
    id: "family-proof",
    title: "Family and kids proof",
    description: "Profiles with kids or youth ministry signals for families turning a church search into a Sunday plan.",
    href: "/church/family-friendly-churches",
    linkLabel: "Browse family-ready profiles",
    filters: { hasKids: true },
  },
  {
    id: "english-language-proof",
    title: "English-language proof",
    description: "Profiles with English-language signals for expats, students, and international visitors.",
    href: "/church/english-speaking-churches",
    linkLabel: "Browse English-language profiles",
    filters: { language: "English" },
  },
] satisfies ChurchChoiceEvidenceGroup[];
