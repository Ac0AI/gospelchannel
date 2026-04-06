import {
  filterChurchDirectory,
  matchesDenomination,
  matchesStyle,
  type ChurchDirectoryEntry,
} from "@/lib/church-directory";

export type ToolChurchPreview = {
  slug: string;
  name: string;
  description: string;
  country: string;
  href: string;
  thumbnailUrl?: string;
  logo?: string;
  location?: string;
  serviceTimes?: string;
  musicStyle?: string[];
};

type MatchRule = {
  styleSlug?: string;
  denominationSlug?: string;
  slugs?: string[];
};

type ToolLink = {
  href: string;
  label: string;
};

type DiscoveryLaneDefinition = {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  whyItFits: string;
  browse: ToolLink;
  secondary?: ToolLink;
  compare?: ToolLink;
  matchRules: MatchRule[];
};

export type DiscoveryLane = DiscoveryLaneDefinition & {
  sampleChurches: ToolChurchPreview[];
};

type WeightedQuestionOption = {
  value: string;
  label: string;
  description: string;
  weights: Partial<Record<QuizLaneId, number>>;
};

export type QuizQuestion = {
  id: string;
  title: string;
  description: string;
  options: WeightedQuestionOption[];
};

type SoundQuestionOption = {
  value: string;
  label: string;
  description: string;
  weights: Partial<Record<SoundProfileId, number>>;
};

export type SoundQuestion = {
  id: string;
  title: string;
  description: string;
  options: SoundQuestionOption[];
};

type SoundProfileDefinition = {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  artistCue: string;
  browse: ToolLink;
  secondary?: ToolLink;
  matchRules: MatchRule[];
};

export type SoundProfile = SoundProfileDefinition & {
  sampleChurches: ToolChurchPreview[];
};

type CompareSection = {
  title: string;
  body: string;
};

type CompareFaq = {
  question: string;
  answer: string;
};

type CompareChoiceDefinition = {
  id: string;
  title: string;
  description: string;
  bestFor: string;
  browse: ToolLink;
  secondary?: ToolLink;
  matchRules: MatchRule[];
};

export type CompareChoice = CompareChoiceDefinition & {
  sampleChurches: ToolChurchPreview[];
};

type CompareGuideDefinition = {
  slug: string;
  title: string;
  description: string;
  summary: string;
  intro: string;
  checklist: string[];
  sections: CompareSection[];
  faqs: CompareFaq[];
  choices: CompareChoiceDefinition[];
};

export type CompareGuide = Omit<CompareGuideDefinition, "choices"> & {
  choices: CompareChoice[];
};

export type ToolCard = {
  href: string;
  title: string;
  description: string;
  eyebrow: string;
  icon?: string;
};

export type CompareCard = {
  href: string;
  title: string;
  description: string;
};

export const GUIDE_CARDS: ToolCard[] = [
  {
    href: "/guides/church-fit-quiz",
    title: "Church Fit Quiz",
    description: "Answer seven fast questions and get three church paths that fit your worship style, social comfort, and Sunday priorities.",
    eyebrow: "Main tool",
  },
  {
    href: "/guides/first-visit-guide",
    title: "First-Time Church Guide",
    description: "Know what usually happens on a Sunday, what to wear, what kids ministry means, and how traditions feel before you go.",
    eyebrow: "Visitor confidence",
    icon: "church",
  },
  {
    href: "/guides/worship-style-match",
    title: "Church Sound Match",
    description: "Match your worship taste to church styles, browse routes, and real churches that already sound close to home.",
    eyebrow: "Music-first",
  },
  {
    href: "/guides/prayer-guide",
    title: "How to Start Praying",
    description: "A simple, honest guide for your first conversation with God. No special words needed.",
    eyebrow: "Guide",
    icon: "hands",
  },
];

export const COMPARE_CARDS: CompareCard[] = [
  {
    href: "/compare/traditional-vs-contemporary-worship",
    title: "Traditional vs Contemporary Worship",
    description: "Choose between rooted liturgy and modern worship flow without guessing.",
  },
  {
    href: "/compare/baptist-vs-pentecostal",
    title: "Baptist vs Pentecostal",
    description: "Compare teaching style, worship energy, and what Sunday usually feels like.",
  },
  {
    href: "/compare/liturgical-vs-free-worship",
    title: "Liturgical vs Free Worship",
    description: "Understand structure, prayer flow, and how much spontaneity you want in the room.",
  },
  {
    href: "/compare/big-church-vs-small-church",
    title: "Big Church vs Small Church",
    description: "Work out whether you want a larger worship room or a tighter-knit Sunday rhythm.",
  },
];

const DISCOVERY_LANE_DEFINITIONS: DiscoveryLaneDefinition[] = [
  {
    id: "anthem-contemporary",
    title: "Contemporary & Welcoming",
    shortTitle: "Contemporary",
    description: "A modern worship lane with clear entry points, familiar song language, and low-friction first visits.",
    whyItFits: "This lane fits people who want a warm modern service without needing to decode lots of tradition first.",
    browse: { href: "/church/style/contemporary-worship", label: "See contemporary churches" },
    secondary: { href: "/compare/traditional-vs-contemporary-worship", label: "Compare worship styles" },
    compare: { href: "/compare/traditional-vs-contemporary-worship", label: "Traditional vs contemporary" },
    matchRules: [{ styleSlug: "contemporary-worship" }, { styleSlug: "rock" }],
  },
  {
    id: "spirit-led",
    title: "Spirit-Led & Expressive",
    shortTitle: "Spirit-led",
    description: "A freer worship lane with space for prayer response, spontaneous moments, and higher emotional range.",
    whyItFits: "This lane fits people who want worship to feel open, expectant, and more expressive than scripted.",
    browse: { href: "/church/style/charismatic", label: "See spirit-led churches" },
    secondary: { href: "/church/denomination/pentecostal", label: "Browse Pentecostal churches" },
    compare: { href: "/compare/liturgical-vs-free-worship", label: "Liturgical vs free worship" },
    matchRules: [{ styleSlug: "charismatic" }, { denominationSlug: "pentecostal" }, { denominationSlug: "charismatic" }],
  },
  {
    id: "gospel-celebration",
    title: "Gospel Celebration",
    shortTitle: "Gospel",
    description: "A joyful lane for choir energy, strong room response, fuller call-and-response moments, and celebration-led worship.",
    whyItFits: "This lane fits people who want joy, musical lift, and a room that sings back with real energy.",
    browse: { href: "/church/style/gospel", label: "See gospel churches" },
    secondary: { href: "/church/style/charismatic", label: "See expressive churches" },
    compare: { href: "/compare/big-church-vs-small-church", label: "Big room vs smaller spaces" },
    matchRules: [{ styleSlug: "gospel" }],
  },
  {
    id: "historic-rooted",
    title: "Historic & Rooted",
    shortTitle: "Rooted",
    description: "A rooted lane for people who feel calm with liturgy, structure, older traditions, and a steadier service rhythm.",
    whyItFits: "This lane fits people who want a deeper sense of tradition, continuity, and predictable service flow.",
    browse: { href: "/church/denomination/anglican", label: "See rooted churches" },
    secondary: { href: "/church/denomination/lutheran", label: "Browse Lutheran churches" },
    compare: { href: "/compare/liturgical-vs-free-worship", label: "Liturgical vs free worship" },
    matchRules: [{ denominationSlug: "anglican" }, { denominationSlug: "lutheran" }],
  },
  {
    id: "acoustic-reflective",
    title: "Acoustic & Reflective",
    shortTitle: "Acoustic",
    description: "A gentler lane for intimate worship, quieter rooms, and a lower-pressure Sunday feel.",
    whyItFits: "This lane fits people who want Sunday to feel calm, intimate, and less driven by big-stage energy.",
    browse: { href: "/church/style/acoustic", label: "See acoustic churches" },
    secondary: { href: "/compare/traditional-vs-contemporary-worship", label: "Compare worship styles" },
    compare: { href: "/compare/big-church-vs-small-church", label: "Big room vs smaller spaces" },
    matchRules: [{ styleSlug: "acoustic" }],
  },
  {
    id: "scripture-community",
    title: "Scripture & Community",
    shortTitle: "Community",
    description: "A grounded lane for clear teaching, stronger community rhythms, and a Sunday you can grow into steadily.",
    whyItFits: "This lane fits people who want solid teaching, a friendlier weekly rhythm, and a church they can settle into locally.",
    browse: { href: "/church/denomination/baptist", label: "See grounded churches" },
    secondary: { href: "/church/denomination/evangelical", label: "Browse evangelical churches" },
    compare: { href: "/compare/baptist-vs-pentecostal", label: "Baptist vs Pentecostal" },
    matchRules: [{ denominationSlug: "baptist" }, { denominationSlug: "evangelical" }],
  },
  {
    id: "global-multilingual",
    title: "Global & Multilingual",
    shortTitle: "Global",
    description: "A globally-shaped lane for multilingual worship, diaspora communities, and cross-cultural church life.",
    whyItFits: "This lane fits people who want worship cultures shaped by language, migration, and broader global church expression.",
    browse: { href: "/church/style/latin", label: "See global churches" },
    secondary: { href: "/church/style/african", label: "Browse African & diaspora churches" },
    compare: { href: "/compare/big-church-vs-small-church", label: "Big room vs smaller spaces" },
    matchRules: [{ styleSlug: "latin" }, { styleSlug: "african" }],
  },
];

export type QuizLaneId = (typeof DISCOVERY_LANE_DEFINITIONS)[number]["id"];

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "energy",
    title: "What kind of worship room helps you open up fastest?",
    description: "Pick the Sunday atmosphere that feels easiest to enter right now.",
    options: [
      {
        value: "quiet",
        label: "Quiet and reflective",
        description: "I want a calmer room and space to settle in.",
        weights: { "acoustic-reflective": 3, "historic-rooted": 2, "scripture-community": 1 },
      },
      {
        value: "balanced",
        label: "Balanced and warm",
        description: "Modern but not overwhelming.",
        weights: { "anthem-contemporary": 2, "scripture-community": 2, "historic-rooted": 1 },
      },
      {
        value: "expressive",
        label: "Expressive and spirit-led",
        description: "I want space for response and freer worship.",
        weights: { "spirit-led": 3, "anthem-contemporary": 1, "gospel-celebration": 1 },
      },
      {
        value: "full-room",
        label: "Joyful and full-room",
        description: "I want lift, momentum, and strong room energy.",
        weights: { "gospel-celebration": 3, "anthem-contemporary": 2, "spirit-led": 1, "global-multilingual": 1 },
      },
    ],
  },
  {
    id: "tradition",
    title: "How open are you to historic structure and liturgy?",
    description: "This is less about right or wrong and more about what feels natural on a first visit.",
    options: [
      {
        value: "rooted",
        label: "I want something rooted",
        description: "A stronger sense of tradition sounds good to me.",
        weights: { "historic-rooted": 4, "acoustic-reflective": 1 },
      },
      {
        value: "open",
        label: "Open if it feels welcoming",
        description: "I can handle some structure if the room still feels approachable.",
        weights: { "scripture-community": 2, "anthem-contemporary": 2, "historic-rooted": 1 },
      },
      {
        value: "modern",
        label: "Mostly modern and low-friction",
        description: "I want something easy to understand on day one.",
        weights: { "anthem-contemporary": 3, "spirit-led": 1, "acoustic-reflective": 1 },
      },
      {
        value: "free",
        label: "Freer worship flow",
        description: "I prefer less scripted worship and more openness.",
        weights: { "spirit-led": 3, "gospel-celebration": 1, "global-multilingual": 1 },
      },
    ],
  },
  {
    id: "size",
    title: "What room size feels most comfortable right now?",
    description: "Use your instinct. This shapes how much anonymity or familiarity you may want.",
    options: [
      {
        value: "small",
        label: "Smaller and more personal",
        description: "I would rather know people faster.",
        weights: { "scripture-community": 3, "acoustic-reflective": 2, "historic-rooted": 1 },
      },
      {
        value: "mid",
        label: "Mid-size and clear",
        description: "I want enough life without feeling lost.",
        weights: { "anthem-contemporary": 2, "scripture-community": 2, "global-multilingual": 1 },
      },
      {
        value: "large",
        label: "Large room, lots happening",
        description: "I am comfortable with a bigger worship environment.",
        weights: { "anthem-contemporary": 3, "spirit-led": 2, "gospel-celebration": 1 },
      },
      {
        value: "flexible",
        label: "Flexible",
        description: "The overall fit matters more than room size.",
        weights: {
          "anthem-contemporary": 1,
          "scripture-community": 1,
          "historic-rooted": 1,
          "gospel-celebration": 1,
        },
      },
    ],
  },
  {
    id: "family",
    title: "How much do kids or youth ministries matter for this search?",
    description: "Even if you are not searching for your family, this helps us understand your Sunday priorities.",
    options: [
      {
        value: "high",
        label: "Very important",
        description: "Strong family programming matters.",
        weights: { "anthem-contemporary": 2, "scripture-community": 2, "global-multilingual": 1 },
      },
      {
        value: "some",
        label: "Helpful, not decisive",
        description: "Good to have, but not the main thing.",
        weights: { "anthem-contemporary": 1, "scripture-community": 1, "historic-rooted": 1 },
      },
      {
        value: "low",
        label: "Not a factor",
        description: "I am choosing mostly by worship and service feel.",
        weights: { "historic-rooted": 1, "acoustic-reflective": 1, "spirit-led": 1 },
      },
      {
        value: "all-ages",
        label: "I like all-ages togetherness",
        description: "Intergenerational Sunday life matters more to me.",
        weights: { "historic-rooted": 2, "gospel-celebration": 1, "global-multilingual": 1, "scripture-community": 1 },
      },
    ],
  },
  {
    id: "teaching",
    title: "What kind of preaching helps you trust a church faster?",
    description: "Think about what makes you want to come back next week.",
    options: [
      {
        value: "verse",
        label: "Verse-by-verse and grounded",
        description: "I want biblical clarity and steadiness.",
        weights: { "scripture-community": 3, "historic-rooted": 2 },
      },
      {
        value: "practical",
        label: "Practical and clear",
        description: "I want help for real life in plain language.",
        weights: { "anthem-contemporary": 2, "scripture-community": 2 },
      },
      {
        value: "prophetic",
        label: "Prophetic and faith-forward",
        description: "I want spiritual expectancy and boldness.",
        weights: { "spirit-led": 3, "gospel-celebration": 1 },
      },
      {
        value: "story",
        label: "Celebratory and story-rich",
        description: "I connect with testimony, joy, and room energy.",
        weights: { "gospel-celebration": 2, "global-multilingual": 2, "anthem-contemporary": 1 },
      },
    ],
  },
  {
    id: "social",
    title: "What social vibe sounds healthiest for your first visit?",
    description: "Some people need quiet space. Others want strong welcome energy.",
    options: [
      {
        value: "spacious",
        label: "Quiet, spacious, no pressure",
        description: "I want room to observe before I engage.",
        weights: { "acoustic-reflective": 3, "historic-rooted": 2 },
      },
      {
        value: "friendly",
        label: "Friendly but not intense",
        description: "Warm is good. Overwhelming is not.",
        weights: { "anthem-contemporary": 2, "scripture-community": 2 },
      },
      {
        value: "social",
        label: "Warm, social, stay-and-talk",
        description: "I want community energy after the service too.",
        weights: { "scripture-community": 2, "gospel-celebration": 2, "global-multilingual": 1 },
      },
      {
        value: "expressive",
        label: "Expressive and open response",
        description: "I am comfortable with visible engagement and response.",
        weights: { "spirit-led": 3, "gospel-celebration": 2 },
      },
    ],
  },
  {
    id: "travel",
    title: "How far are you willing to go for the right church feel?",
    description: "This helps us decide whether to bias toward stable weekly fit or a more destination-like experience.",
    options: [
      {
        value: "local",
        label: "Keep it local and easy",
        description: "I want the simplest good starting point.",
        weights: { "scripture-community": 2, "anthem-contemporary": 1, "historic-rooted": 1 },
      },
      {
        value: "right-fit",
        label: "I can travel for the right fit",
        description: "I am willing to go a bit farther if the culture is right.",
        weights: { "anthem-contemporary": 2, "spirit-led": 2, "gospel-celebration": 1, "global-multilingual": 1 },
      },
      {
        value: "special-worship",
        label: "I will travel if the worship is special",
        description: "Music and room feel are worth a longer trip.",
        weights: { "gospel-celebration": 2, "spirit-led": 2, "global-multilingual": 2 },
      },
      {
        value: "tradition-first",
        label: "Distance matters less than tradition",
        description: "I care more about theological and liturgical fit.",
        weights: { "historic-rooted": 3, "acoustic-reflective": 1 },
      },
    ],
  },
];

const SOUND_PROFILE_DEFINITIONS: SoundProfileDefinition[] = [
  {
    id: "modern-anthems",
    title: "Modern Anthems",
    shortTitle: "Modern anthems",
    description: "Polished, modern worship with strong choruses, familiar live arrangements, and a bigger-room feel.",
    artistCue: "Think Hillsong, Elevation, Bethel, and other modern anthem-led church sounds.",
    browse: { href: "/church/style/contemporary-worship", label: "See modern worship churches" },
    secondary: { href: "/compare/traditional-vs-contemporary-worship", label: "Compare worship styles" },
    matchRules: [{ styleSlug: "contemporary-worship" }, { styleSlug: "rock" }],
  },
  {
    id: "spacious-spirit",
    title: "Spacious & Spirit-Led",
    shortTitle: "Spirit-led",
    description: "Open worship rooms with longer response moments, expectancy, and more spontaneous flow.",
    artistCue: "Think spontaneous nights, prayer-led builds, and rooms that leave space for response.",
    browse: { href: "/church/style/charismatic", label: "See spirit-led churches" },
    secondary: { href: "/church/denomination/pentecostal", label: "Browse Pentecostal churches" },
    matchRules: [{ styleSlug: "charismatic" }, { denominationSlug: "pentecostal" }],
  },
  {
    id: "choir-celebration",
    title: "Choir & Celebration",
    shortTitle: "Choir celebration",
    description: "Choir lift, gospel harmonies, stronger room participation, and celebration-led worship culture.",
    artistCue: "Think Maverick City energy, choir-led Sundays, and call-and-response worship moments.",
    browse: { href: "/church/style/gospel", label: "See gospel churches" },
    secondary: { href: "/church/style/charismatic", label: "See expressive churches" },
    matchRules: [{ styleSlug: "gospel" }],
  },
  {
    id: "acoustic-room",
    title: "Acoustic Room",
    shortTitle: "Acoustic room",
    description: "More stripped-back worship, calmer textures, and an intimate entry point into church music culture.",
    artistCue: "Think acoustic worship sets, lighter instrumentation, and more reflective room energy.",
    browse: { href: "/church/style/acoustic", label: "See acoustic churches" },
    secondary: { href: "/compare/big-church-vs-small-church", label: "Big room vs smaller spaces" },
    matchRules: [{ styleSlug: "acoustic" }],
  },
  {
    id: "latin-rhythm",
    title: "Latin & Spanish Worship",
    shortTitle: "Latin worship",
    description: "Spanish-language or Latin-shaped church music with rhythmic lift and strong congregational warmth.",
    artistCue: "Think Spanish worship, Latin CCM, and churches where language and musical culture shape the room.",
    browse: { href: "/church/style/latin", label: "See Latin worship churches" },
    secondary: { href: "/guides/church-fit-quiz", label: "Take the fit quiz" },
    matchRules: [{ styleSlug: "latin" }],
  },
  {
    id: "african-praise",
    title: "African & Diaspora Praise",
    shortTitle: "African praise",
    description: "High-response praise culture shaped by African gospel, diaspora worship, and joyful congregational participation.",
    artistCue: "Think Sinach, African praise teams, and churches with vibrant diaspora worship culture.",
    browse: { href: "/church/style/african", label: "See African & diaspora churches" },
    secondary: { href: "/guides/church-fit-quiz", label: "Take the fit quiz" },
    matchRules: [{ styleSlug: "african" }],
  },
];

export type SoundProfileId = (typeof SOUND_PROFILE_DEFINITIONS)[number]["id"];

export const SOUND_QUESTIONS: SoundQuestion[] = [
  {
    id: "sound",
    title: "What sound draws you in first?",
    description: "Pick the church sound you would gladly press play on before visiting.",
    options: [
      {
        value: "anthem",
        label: "Modern anthems",
        description: "Big choruses, polished modern worship, familiar live arrangement energy.",
        weights: { "modern-anthems": 4, "spacious-spirit": 1 },
      },
      {
        value: "spirit",
        label: "Spacious and open",
        description: "Longer builds, freer response, and spirit-led room feel.",
        weights: { "spacious-spirit": 4, "modern-anthems": 1 },
      },
      {
        value: "choir",
        label: "Choir and celebration",
        description: "Gospel harmonies, stronger room lift, and celebration-led worship.",
        weights: { "choir-celebration": 4, "spacious-spirit": 1 },
      },
      {
        value: "acoustic",
        label: "Stripped-back and intimate",
        description: "Acoustic textures and calmer room energy.",
        weights: { "acoustic-room": 4, "modern-anthems": 1 },
      },
      {
        value: "latin",
        label: "Latin and Spanish worship",
        description: "Rhythmic lift shaped by Spanish or Latin worship culture.",
        weights: { "latin-rhythm": 4, "choir-celebration": 1 },
      },
      {
        value: "african",
        label: "African praise and diaspora worship",
        description: "Joyful response and global church celebration energy.",
        weights: { "african-praise": 4, "choir-celebration": 1 },
      },
    ],
  },
  {
    id: "feeling",
    title: "What worship feeling are you hoping to find in the room?",
    description: "Choose the feel that would make you stay for a second Sunday.",
    options: [
      {
        value: "modern",
        label: "Modern and uplifting",
        description: "I want clear lift and a current worship sound.",
        weights: { "modern-anthems": 3, "choir-celebration": 1 },
      },
      {
        value: "expectant",
        label: "Expectant and open",
        description: "I want prayer response and spiritual openness in the room.",
        weights: { "spacious-spirit": 3, "modern-anthems": 1 },
      },
      {
        value: "joyful",
        label: "Joyful and full-room",
        description: "I want obvious room participation and celebration energy.",
        weights: { "choir-celebration": 3, "african-praise": 2 },
      },
      {
        value: "intimate",
        label: "Calm and intimate",
        description: "I want the room to feel gentler and more reflective.",
        weights: { "acoustic-room": 3, "modern-anthems": 1 },
      },
      {
        value: "global",
        label: "Multilingual and global",
        description: "I want music culture shaped by language and diaspora life.",
        weights: { "latin-rhythm": 2, "african-praise": 2, "choir-celebration": 1 },
      },
    ],
  },
  {
    id: "artists",
    title: "Which artist lane is closest to your taste?",
    description: "This does not need to be exact. It just nudges the matching toward the sound you already trust.",
    options: [
      {
        value: "hillsong",
        label: "Hillsong / Elevation / Bethel",
        description: "Modern worship anthems with a large-room feel.",
        weights: { "modern-anthems": 4, "spacious-spirit": 1 },
      },
      {
        value: "maverick",
        label: "Maverick City / choir-led nights",
        description: "Celebration-led rooms with gospel lift and response.",
        weights: { "choir-celebration": 4, "spacious-spirit": 1 },
      },
      {
        value: "acoustic",
        label: "Tim Hughes / acoustic worship rooms",
        description: "More intimate worship textures and lower-pressure flow.",
        weights: { "acoustic-room": 4, "modern-anthems": 1 },
      },
      {
        value: "latin",
        label: "Spanish and Latin worship artists",
        description: "I want a church sound closer to Latin worship culture.",
        weights: { "latin-rhythm": 4, "choir-celebration": 1 },
      },
      {
        value: "african",
        label: "African praise leaders and diaspora teams",
        description: "I want a church sound with stronger African or diaspora worship cues.",
        weights: { "african-praise": 4, "choir-celebration": 1 },
      },
      {
        value: "open",
        label: "I am open, just show me the fit",
        description: "Use the other answers and show broad strong matches.",
        weights: {
          "modern-anthems": 1,
          "spacious-spirit": 1,
          "choir-celebration": 1,
          "acoustic-room": 1,
          "latin-rhythm": 1,
          "african-praise": 1,
        },
      },
    ],
  },
];

const COMPARE_GUIDE_DEFINITIONS: CompareGuideDefinition[] = [
  {
    slug: "traditional-vs-contemporary-worship",
    title: "Traditional vs Contemporary Worship",
    description: "Work out whether you want rooted liturgy or a modern worship flow before you visit a church.",
    summary: "Choose between a rooted service rhythm and a modern worship entry point.",
    intro: "This comparison is for church seekers who are not deciding doctrine first. They are deciding what kind of room helps them relax, listen, and actually come back next week.",
    checklist: [
      "Choose traditional if structure, liturgy, and steadier pacing help you trust the room.",
      "Choose contemporary if modern music language and a lower-friction first visit matter most.",
      "Use the compare page as a direction, not a guarantee. Individual churches still vary a lot.",
    ],
    sections: [
      {
        title: "Traditional worship usually feels more rooted",
        body: "Traditional churches often move with more visible structure. That can feel grounding if you want rhythm, continuity, and less pressure to respond outwardly.",
      },
      {
        title: "Contemporary worship usually feels easier to decode",
        body: "Contemporary churches often use more current song language, clearer host moments, and fewer service elements that feel unfamiliar to first-time visitors.",
      },
      {
        title: "Neither option is automatically warmer",
        body: "Some contemporary churches feel anonymous. Some traditional churches feel deeply pastoral. Use worship style as a starting point, then look at service times, community feel, and location.",
      },
    ],
    faqs: [
      {
        question: "Is traditional worship always older in age?",
        answer: "No. Traditional worship is about service shape and liturgical feel more than the age of the room.",
      },
      {
        question: "Is contemporary worship always louder?",
        answer: "Often, but not always. Some contemporary churches are still gentle and highly welcoming.",
      },
    ],
    choices: [
      {
        id: "traditional",
        title: "Start with rooted churches",
        description: "Best for people who want structure, continuity, and a calmer entry point.",
        bestFor: "You want liturgy, steadier pacing, and a stronger sense of tradition.",
        browse: { href: "/church/denomination/anglican", label: "See rooted churches" },
        secondary: { href: "/church/denomination/lutheran", label: "Browse Lutheran churches" },
        matchRules: [{ denominationSlug: "anglican" }, { denominationSlug: "lutheran" }],
      },
      {
        id: "contemporary",
        title: "Start with contemporary churches",
        description: "Best for people who want modern worship language and a lower-friction first visit.",
        bestFor: "You want a room that is easier to decode on your first Sunday.",
        browse: { href: "/church/style/contemporary-worship", label: "See contemporary churches" },
        secondary: { href: "/guides/church-fit-quiz", label: "Take the fit quiz" },
        matchRules: [{ styleSlug: "contemporary-worship" }],
      },
    ],
  },
  {
    slug: "baptist-vs-pentecostal",
    title: "Baptist vs Pentecostal",
    description: "Compare grounded teaching-first churches with more expressive Pentecostal rooms before you visit.",
    summary: "Choose between a steadier teaching lane and a more expressive worship lane.",
    intro: "This guide is not trying to flatten theology into one sentence. It helps a first-time visitor understand what Sunday often feels like at the room level.",
    checklist: [
      "Choose Baptist if grounded teaching and steadier room energy matter most.",
      "Choose Pentecostal if spiritual response, expressive worship, and expectancy matter most.",
      "If you like both, use the fit quiz and check actual church pages before visiting.",
    ],
    sections: [
      {
        title: "Baptist rooms often feel teaching-forward",
        body: "Many Baptist churches lead with clear preaching, grounded discipleship language, and a steadier Sunday rhythm that can feel easier to grow into weekly.",
      },
      {
        title: "Pentecostal rooms often feel more expressive",
        body: "Pentecostal churches often make more room for prayer response, visible expectation, and freer worship moments than a teaching-first room might.",
      },
      {
        title: "Hospitality varies on both sides",
        body: "Do not assume one tradition is automatically better for visitors. Use worship feel, sermon style, and community cues together.",
      },
    ],
    faqs: [
      {
        question: "Do Baptist churches always avoid expressive worship?",
        answer: "No. Some Baptist churches are quite lively. The difference is often about overall emphasis and room expectations.",
      },
      {
        question: "Are Pentecostal churches always high-energy?",
        answer: "No. Many are. But the deeper distinction is usually openness to spiritual response and room expression.",
      },
    ],
    choices: [
      {
        id: "baptist",
        title: "Start with Baptist and grounded churches",
        description: "Best for people who want teaching clarity and a steadier Sunday rhythm.",
        bestFor: "You care most about grounded preaching and a stable weekly church home.",
        browse: { href: "/church/denomination/baptist", label: "See Baptist churches" },
        secondary: { href: "/church/denomination/evangelical", label: "Browse evangelical churches" },
        matchRules: [{ denominationSlug: "baptist" }, { denominationSlug: "evangelical" }],
      },
      {
        id: "pentecostal",
        title: "Start with Pentecostal churches",
        description: "Best for people who want stronger room response and more expressive worship.",
        bestFor: "You want openness, prayer response, and a worship room with more visible expectancy.",
        browse: { href: "/church/denomination/pentecostal", label: "See Pentecostal churches" },
        secondary: { href: "/church/style/charismatic", label: "Browse spirit-led churches" },
        matchRules: [{ denominationSlug: "pentecostal" }, { styleSlug: "charismatic" }],
      },
    ],
  },
  {
    slug: "liturgical-vs-free-worship",
    title: "Liturgical vs Free Worship",
    description: "Compare structured liturgical flow with freer worship spaces so you know what kind of room to try first.",
    summary: "Choose between clear structure and freer response before your first visit.",
    intro: "A lot of first-time visitors do not know whether service structure will feel calming or distancing. This page is meant to reduce that uncertainty before Sunday.",
    checklist: [
      "Choose liturgical if known structure helps you relax and participate.",
      "Choose free worship if you want more room for response and less scripted flow.",
      "If you are unsure, start with the fit quiz and compare actual service cues on church pages.",
    ],
    sections: [
      {
        title: "Liturgical services trade surprise for continuity",
        body: "Liturgical rooms often make participation easier for people who feel calmer when the service has known landmarks and a slower, repeatable rhythm.",
      },
      {
        title: "Free worship trades predictability for openness",
        body: "Freer worship spaces can feel alive and responsive, especially if you want more room for prayer, expectancy, and spontaneous turns in the service.",
      },
      {
        title: "Visitor comfort depends on your nervous system too",
        body: "Some people feel safer with structure. Others feel trapped by it. Pick the lane that lowers your resistance to showing up again.",
      },
    ],
    faqs: [
      {
        question: "Does liturgical mean formal and distant?",
        answer: "Not necessarily. Some liturgical churches are deeply warm and relational even when the service shape is structured.",
      },
      {
        question: "Does free worship mean chaotic?",
        answer: "Not necessarily. Some freer churches are well-led and pastorally clear even with more openness in the room.",
      },
    ],
    choices: [
      {
        id: "liturgical",
        title: "Start with liturgical churches",
        description: "Best for people who want structure, continuity, and steadier pacing.",
        bestFor: "You relax faster when the service has known shape and stronger continuity.",
        browse: { href: "/church/denomination/anglican", label: "See liturgical churches" },
        secondary: { href: "/church/denomination/lutheran", label: "Browse Lutheran churches" },
        matchRules: [{ denominationSlug: "anglican" }, { denominationSlug: "lutheran" }],
      },
      {
        id: "free",
        title: "Start with freer worship churches",
        description: "Best for people who want response, expectancy, and more expressive worship flow.",
        bestFor: "You want the room to feel more open than scripted.",
        browse: { href: "/church/style/charismatic", label: "See freer worship churches" },
        secondary: { href: "/church/denomination/pentecostal", label: "Browse Pentecostal churches" },
        matchRules: [{ styleSlug: "charismatic" }, { denominationSlug: "pentecostal" }],
      },
    ],
  },
  {
    slug: "big-church-vs-small-church",
    title: "Big Church vs Small Church",
    description: "Work out whether you want a larger worship room or a tighter-knit Sunday rhythm before you visit.",
    summary: "Choose between larger-room energy and closer-knit weekly rhythm.",
    intro: "Most church seekers are not really asking for attendance numbers. They are asking whether they want anonymity, stronger production, easier entry, or faster community.",
    checklist: [
      "Choose the larger-room lane if music, momentum, and lots of entry points matter most.",
      "Choose the smaller-room lane if you want people to know you faster and Sunday to feel more personal.",
      "If this tradeoff feels hard, take the fit quiz instead of guessing.",
    ],
    sections: [
      {
        title: "Large-room churches can lower first-visit friction",
        body: "Bigger churches often make it easier to slip in, observe, and experience a stronger music and production environment before committing socially.",
      },
      {
        title: "Smaller-room churches can speed up community",
        body: "Smaller or steadier-feel rooms often make it easier to be remembered, build rhythm, and feel known faster if that matters to you.",
      },
      {
        title: "This is about feel, not superiority",
        body: "Some people need breathing room before community. Others need faster human connection. Pick the lane that makes a second visit more likely.",
      },
    ],
    faqs: [
      {
        question: "Are big churches always less personal?",
        answer: "No. Many have strong welcome systems and smaller groups that help people settle in.",
      },
      {
        question: "Are smaller churches always quieter?",
        answer: "No. Some smaller churches still have high worship energy. The key difference is often how visible and relational the room feels.",
      },
    ],
    choices: [
      {
        id: "big-room",
        title: "Start with bigger-room worship",
        description: "Best for people who want music lift, clearer entry points, and more room to observe at first.",
        bestFor: "You want a stronger worship environment before you decide on community fit.",
        browse: { href: "/church/style/contemporary-worship", label: "See bigger-room worship lanes" },
        secondary: { href: "/church/style/charismatic", label: "Browse expressive churches" },
        matchRules: [{ styleSlug: "contemporary-worship" }, { styleSlug: "charismatic" }],
      },
      {
        id: "smaller-room",
        title: "Start with steadier smaller-room lanes",
        description: "Best for people who want quieter pacing, stronger groundedness, or faster connection.",
        bestFor: "You want Sunday to feel more personal or less overwhelming.",
        browse: { href: "/church/style/acoustic", label: "See steadier church lanes" },
        secondary: { href: "/church/denomination/baptist", label: "Browse grounded churches" },
        matchRules: [{ styleSlug: "acoustic" }, { denominationSlug: "baptist" }, { denominationSlug: "anglican" }],
      },
    ],
  },
];

export function toToolChurchPreview(church: ChurchDirectoryEntry): ToolChurchPreview {
  return {
    slug: church.slug,
    name: church.name,
    description: church.enrichmentHint?.summary || church.description || "Church profile",
    country: church.country,
    href: `/church/${church.slug}`,
    thumbnailUrl: church.thumbnailUrl,
    logo: church.logo,
    location: church.enrichmentHint?.location || church.location,
    serviceTimes: church.enrichmentHint?.serviceTimes,
    musicStyle: church.musicStyle,
  };
}

function matchesRule(church: ChurchDirectoryEntry, rule: MatchRule): boolean {
  if (rule.styleSlug && matchesStyle(church.musicStyle, rule.styleSlug)) return true;
  if (rule.denominationSlug && matchesDenomination(church.denomination, rule.denominationSlug)) return true;
  if (rule.slugs?.includes(church.slug)) return true;
  return false;
}

function collectSampleChurches(
  churches: ChurchDirectoryEntry[],
  matchRules: MatchRule[],
  limit = 4,
): ToolChurchPreview[] {
  const sorted = filterChurchDirectory(churches);
  const matches = sorted.filter((church) => matchRules.some((rule) => matchesRule(church, rule)));
  const pool = matches.length > 0 ? matches : sorted;
  return pool.slice(0, limit).map(toToolChurchPreview);
}

export function buildDiscoveryLanes(churches: ChurchDirectoryEntry[]): DiscoveryLane[] {
  return DISCOVERY_LANE_DEFINITIONS.map((lane) => ({
    ...lane,
    sampleChurches: collectSampleChurches(churches, lane.matchRules),
  }));
}

export function scoreQuizLanes(answers: Record<string, string>, lanes: DiscoveryLane[]): DiscoveryLane[] {
  const totals = new Map<string, number>(lanes.map((lane, index) => [lane.id, index * 0.001]));

  for (const question of QUIZ_QUESTIONS) {
    const value = answers[question.id];
    const option = question.options.find((item) => item.value === value);
    if (!option) continue;
    for (const lane of lanes) {
      totals.set(lane.id, (totals.get(lane.id) ?? 0) + (option.weights[lane.id as QuizLaneId] ?? 0));
    }
  }

  return [...lanes]
    .sort((a, b) => (totals.get(b.id) ?? 0) - (totals.get(a.id) ?? 0))
    .slice(0, 3);
}

export function collectLaneChurchMatches(
  churches: ChurchDirectoryEntry[],
  lanes: DiscoveryLane[],
  options: {
    query?: string;
    limit?: number;
  } = {},
): ToolChurchPreview[] {
  const limit = options.limit ?? 6;
  const query = options.query?.trim() ?? "";
  const pool = query
    ? filterChurchDirectory(churches, { query })
    : filterChurchDirectory(churches);
  const seen = new Set<string>();
  const matches: ToolChurchPreview[] = [];

  for (const lane of lanes) {
    for (const church of pool) {
      if (seen.has(church.slug)) continue;
      if (!lane.matchRules.some((rule) => matchesRule(church, rule))) continue;
      seen.add(church.slug);
      matches.push(toToolChurchPreview(church));
      if (matches.length >= limit) {
        return matches;
      }
    }
  }

  if (matches.length > 0 || query) {
    return matches;
  }

  return collectTopChurchMatches(lanes, limit);
}

export function buildSoundProfiles(churches: ChurchDirectoryEntry[]): SoundProfile[] {
  return SOUND_PROFILE_DEFINITIONS.map((profile) => ({
    ...profile,
    sampleChurches: collectSampleChurches(churches, profile.matchRules),
  }));
}

export function scoreSoundProfiles(answers: Record<string, string>, profiles: SoundProfile[]): SoundProfile[] {
  const totals = new Map<string, number>(profiles.map((profile, index) => [profile.id, index * 0.001]));

  for (const question of SOUND_QUESTIONS) {
    const value = answers[question.id];
    const option = question.options.find((item) => item.value === value);
    if (!option) continue;
    for (const profile of profiles) {
      totals.set(profile.id, (totals.get(profile.id) ?? 0) + (option.weights[profile.id as SoundProfileId] ?? 0));
    }
  }

  return [...profiles]
    .sort((a, b) => (totals.get(b.id) ?? 0) - (totals.get(a.id) ?? 0))
    .slice(0, 3);
}

export function collectTopChurchMatches(items: Array<{ sampleChurches: ToolChurchPreview[] }>, limit = 6): ToolChurchPreview[] {
  const seen = new Set<string>();
  const matches: ToolChurchPreview[] = [];

  for (const item of items) {
    for (const church of item.sampleChurches) {
      if (seen.has(church.slug)) continue;
      seen.add(church.slug);
      matches.push(church);
      if (matches.length >= limit) {
        return matches;
      }
    }
  }

  return matches;
}

export function getCompareGuideBySlug(slug: string): CompareGuideDefinition | undefined {
  return COMPARE_GUIDE_DEFINITIONS.find((guide) => guide.slug === slug);
}

export function buildCompareGuide(slug: string, churches: ChurchDirectoryEntry[]): CompareGuide | undefined {
  const guide = getCompareGuideBySlug(slug);
  if (!guide) return undefined;

  return {
    ...guide,
    choices: guide.choices.map((choice) => ({
      ...choice,
      sampleChurches: collectSampleChurches(churches, choice.matchRules, 3),
    })),
  };
}

export function getCompareGuideSlugs(): string[] {
  return COMPARE_GUIDE_DEFINITIONS.map((guide) => guide.slug);
}

export function getCompareGuides(): CompareGuideDefinition[] {
  return COMPARE_GUIDE_DEFINITIONS;
}

/* ------------------------------------------------------------------ */
/*  Compare guide illustrated content                                  */
/* ------------------------------------------------------------------ */

type CompareAspect = {
  title: string;
  illustration: string;
  illustrationAlt: string;
  sideA: string;
  sideB: string;
  body: string;
};

type CompareGuideContent = {
  slug: string;
  eyebrow: string;
  title: string;
  intro: string;
  labelA: string;
  labelB: string;
  aspects: CompareAspect[];
  quoteA?: { text: string };
  quoteB?: { text: string };
  nudge: string;
  ctaA: { label: string; href: string };
  ctaB: { label: string; href: string };
  faq: Array<{ question: string; answer: string }>;
};

const COMPARE_GUIDE_CONTENT: CompareGuideContent[] = [
  /* ---- Traditional vs Contemporary ---- */
  {
    slug: "traditional-vs-contemporary-worship",
    eyebrow: "Compare Guide",
    title: "Traditional vs Contemporary Worship",
    intro: "Two different ways to spend a Sunday morning. Neither is better - they just feel different. Here is what you will actually notice when you walk in.",
    labelA: "Traditional",
    labelB: "Contemporary",
    aspects: [
      {
        title: "The Sound",
        illustration: "https://media.gospelchannel.com/guides/compare-traditional-vs-contemporary/01-sound.png",
        illustrationAlt: "Split scene: organ and hymn books on one side, electric guitars and screens on the other",
        sideA: "Organ, piano, choir. Hymns that are 100-400 years old. The congregation sings together from a hymnal or printed bulletin. The sound fills the room from the front.",
        sideB: "Band with drums, electric guitar, keyboards. Songs written in the last 10-20 years. Lyrics on a big screen so nobody needs a book. Sounds closer to a concert.",
        body: "This is the biggest difference most people notice on day one. If you grew up with hymns, contemporary can feel loud and unfamiliar. If you did not, traditional can feel formal. Both styles carry real weight for the people singing them.",
      },
      {
        title: "The Room",
        illustration: "https://media.gospelchannel.com/guides/compare-traditional-vs-contemporary/02-room.png",
        illustrationAlt: "Split scene: stained glass and wooden pews on one side, modern stage lighting and chairs on the other",
        sideA: "Pews, stained glass, hymnals in the seat rack, maybe a cross on the wall. The building often feels like it has been there a long time. Quieter before the service starts.",
        sideB: "Chairs, screens, stage lighting, a welcome desk near the entrance. The room often feels newer or recently renovated. Coffee bar in the lobby is common.",
        body: "The room sets a tone before anyone says a word. Traditional spaces feel steady and sacred. Contemporary spaces feel casual and approachable. Neither feeling is more real - it just depends on what helps you settle in.",
      },
      {
        title: "The People",
        illustration: "https://media.gospelchannel.com/guides/compare-traditional-vs-contemporary/03-people.png",
        illustrationAlt: "Split scene: people in more formal dress on one side, casual jeans-and-sneakers crowd on the other",
        sideA: "People tend to dress a bit more formally. Greeting might be a handshake or a nod. The room is often quieter between moments. Age range often skews older, though younger people are returning to traditional worship.",
        sideB: "Jeans, sneakers, coffee cups. Greeters at the door are common. The room often feels social before the service. Age range can be wide, but the culture leans casual.",
        body: "Dress and social energy vary a lot from church to church, but this gives you a rough idea of what to expect. The real warmth of a community shows up after a few visits, not in the first five minutes.",
      },
      {
        title: "A Typical Sunday",
        illustration: "https://media.gospelchannel.com/guides/compare-traditional-vs-contemporary/04-sunday.png",
        illustrationAlt: "Split scene: order of service bulletin on one side, worship band on stage on the other",
        sideA: "Opening hymn, Scripture reading, prayers, sermon, closing hymn, benediction. Communion on set weeks. The order is printed so you always know what comes next.",
        sideB: "Worship set (3-5 songs), welcome and announcements, sermon, maybe a closing song or response moment. Less printed structure - the host guides you through.",
        body: "Knowing what to expect matters more than most people admit. If predictability helps you relax, traditional flow is easier to follow on day one. If you prefer to just be guided through, contemporary services do that well.",
      },
      {
        title: "The Feel",
        illustration: "https://media.gospelchannel.com/guides/compare-traditional-vs-contemporary/05-feel.png",
        illustrationAlt: "Split scene: quiet reverent moment on one side, hands raised in worship on the other",
        sideA: "Reverent, steady, grounded. There is a sense of stepping into something ancient. Some people find it calming. Others find it stiff at first.",
        sideB: "Energetic, accessible, current. There is a sense of being welcomed into something alive. Some people find it freeing. Others find it overwhelming at first.",
        body: "This is the one that matters most. Trust your gut. The right feel is the one that makes you want to come back, not the one that impresses you most on the first visit.",
      },
    ],
    quoteA: { text: "There is something about singing the same words Christians have sung for centuries. It connects you to something bigger than this room." },
    quoteB: { text: "The music hits different when it sounds like something you would actually listen to in the car. It does not feel like church - it just feels like worship." },
    nudge: "Most people have a gut feeling by now. Trust it. And remember - plenty of churches blend both styles, so you are not locked into one lane.",
    ctaA: { label: "Browse traditional churches", href: "/church/style/traditional" },
    ctaB: { label: "Browse contemporary churches", href: "/church/style/contemporary-worship" },
    faq: [
      { question: "Can a church be both traditional and contemporary?", answer: "Yes. Many churches run different services - a traditional one in the morning and a contemporary one later. Some blend both styles in a single service." },
      { question: "Is traditional worship dying out?", answer: "No. There is actually a growing movement of younger people returning to traditional and liturgical worship. Both styles are alive and well." },
      { question: "Which style is more biblical?", answer: "Neither. The Bible does not prescribe a worship style. Both traditions draw from Scripture and have deep theological roots." },
    ],
  },

  /* ---- Baptist vs Pentecostal ---- */
  {
    slug: "baptist-vs-pentecostal",
    eyebrow: "Compare Guide",
    title: "Baptist vs Pentecostal",
    intro: "Two traditions that both love Jesus but feel very different on a Sunday morning. This guide is about what you will actually notice in the room, not theology textbooks.",
    labelA: "Baptist",
    labelB: "Pentecostal",
    aspects: [
      {
        title: "The Sound",
        illustration: "https://media.gospelchannel.com/guides/compare-baptist-vs-pentecostal/01-sound.png",
        illustrationAlt: "Split scene: choir and piano in a Baptist church on one side, full worship band with raised hands on the other",
        sideA: "Can range from traditional hymns with a choir to a modern worship band, depending on the church. The music often serves the sermon - it sets the tone but does not dominate the service.",
        sideB: "Usually a full worship band. The music set tends to be longer and builds in intensity. Songs often repeat sections to create space for response. Expect more volume and energy.",
        body: "Baptist churches vary widely in music style, from old-school hymns to full contemporary bands. Pentecostal churches almost always lean toward louder, more expressive music. If the worship set matters a lot to you, listen to a church's playlist before visiting.",
      },
      {
        title: "The Room",
        illustration: "https://media.gospelchannel.com/guides/compare-baptist-vs-pentecostal/02-room.png",
        illustrationAlt: "Split scene: traditional Baptist sanctuary with pews on one side, colorful Pentecostal auditorium on the other",
        sideA: "Ranges from classic sanctuaries with wooden pews to modern auditoriums. The room often feels orderly and prepared. Bulletins or programs are common so you can follow along.",
        sideB: "Often more colorful or dramatic stage setups. Screens, lighting, and audio tend to be prominent. The room can feel more like a concert venue, especially in larger churches.",
        body: "Both traditions have churches that range from simple to polished. The room alone will not tell you everything - but it does hint at the overall energy you are walking into.",
      },
      {
        title: "The Energy",
        illustration: "https://media.gospelchannel.com/guides/compare-baptist-vs-pentecostal/03-people.png",
        illustrationAlt: "Split scene: attentive seated congregation on one side, people standing with hands raised on the other",
        sideA: "People tend to sit, listen, and participate in quieter ways. Responses are often internal. You might hear an occasional amen, but the room usually stays composed.",
        sideB: "People often stand, raise hands, clap, and respond out loud. Prayer moments can include people moving to the front. The room's energy is visible and sometimes intense.",
        body: "This is often the biggest surprise for first-timers. If you prefer to observe quietly, a Baptist room may feel more comfortable at first. If you want to feel the energy of a room full of people responding openly, Pentecostal churches deliver that.",
      },
      {
        title: "A Typical Sunday",
        illustration: "https://media.gospelchannel.com/guides/compare-baptist-vs-pentecostal/04-sunday.png",
        illustrationAlt: "Split scene: pastor at a pulpit with open Bible on one side, pastor walking the stage with a microphone on the other",
        sideA: "Worship (15-25 min), announcements, sermon (30-45 min), closing prayer or hymn. The sermon is the centerpiece. Teaching tends to be verse-by-verse or topical with clear biblical grounding.",
        sideB: "Extended worship (20-40 min), sermon (25-40 min), altar call or prayer response. The worship and response often feel as important as the sermon. Teaching style varies but often includes personal testimony and spiritual boldness.",
        body: "Baptist churches tend to anchor the service in the sermon. Pentecostal churches tend to give equal weight to worship and response. Neither approach is wrong - it comes down to what helps you engage.",
      },
      {
        title: "The Approach to Faith",
        illustration: "https://media.gospelchannel.com/guides/compare-baptist-vs-pentecostal/05-feel.png",
        illustrationAlt: "Split scene: person studying Bible quietly on one side, person praying with hands outstretched on the other",
        sideA: "Emphasis on Scripture, personal study, and growing through understanding. Faith is often expressed through learning, service, and steady community life. Less emphasis on visible supernatural experiences.",
        sideB: "Emphasis on the Holy Spirit's active work, prayer, healing, and spiritual gifts. Faith is often expressed through visible response, expectancy, and openness to the supernatural in everyday life.",
        body: "This is less about which approach is right and more about which one fits where you are right now. Some people need grounding first. Others need to feel something move. Both paths lead to real faith.",
      },
    ],
    quoteA: { text: "I needed a place where I could ask hard questions and get real answers from the Bible. My Baptist church gave me that foundation." },
    quoteB: { text: "I walked in skeptical and left in tears. Something in that room was real and I could feel it. That is what brought me back." },
    nudge: "Both traditions are full of real, caring churches. If you are unsure, visit one of each. You will know in the first fifteen minutes which room feels more like home.",
    ctaA: { label: "Browse Baptist churches", href: "/church/denomination/baptist" },
    ctaB: { label: "Browse Pentecostal churches", href: "/church/denomination/pentecostal" },
    faq: [
      { question: "Do Baptist churches ever raise hands or get expressive?", answer: "Some do, especially more contemporary Baptist churches. The range is wide. But the overall culture tends to be more reserved than Pentecostal rooms." },
      { question: "Are Pentecostal churches welcoming to newcomers?", answer: "Most are very welcoming. The energy can feel intense at first, but Pentecostal churches are often warm and quick to connect with visitors." },
      { question: "Can I believe in the Holy Spirit and still go to a Baptist church?", answer: "Absolutely. Baptist churches believe in the Holy Spirit too. The difference is more about how openly spiritual gifts are practiced in the service, not whether the Spirit is valued." },
    ],
  },

  /* ---- Liturgical vs Free Worship ---- */
  {
    slug: "liturgical-vs-free-worship",
    eyebrow: "Compare Guide",
    title: "Liturgical vs Free Worship",
    intro: "Some churches follow a set order every week. Others leave room for the service to go wherever it goes. Here is what each actually feels like from the seat.",
    labelA: "Liturgical",
    labelB: "Free Worship",
    aspects: [
      {
        title: "The Sound",
        illustration: "https://media.gospelchannel.com/guides/compare-liturgical-vs-free/01-sound.png",
        illustrationAlt: "Split scene: choir singing from a hymnal on one side, worship leader with eyes closed improvising on the other",
        sideA: "Hymns, choral pieces, sometimes chanted psalms. The music follows the church calendar and has been chosen in advance. Congregational singing from a book or printed sheet is common.",
        sideB: "Modern worship songs, often with extended instrumental sections. The worship leader may repeat a chorus or shift into a spontaneous moment. The set list might change mid-service.",
        body: "Liturgical music feels curated and rooted. Free worship music feels responsive and alive. If you like knowing every song before you arrive, liturgical is easier to prepare for. If you like being surprised, free worship keeps things fresh.",
      },
      {
        title: "The Room",
        illustration: "https://media.gospelchannel.com/guides/compare-liturgical-vs-free/02-room.png",
        illustrationAlt: "Split scene: ornate church interior with altar and candles on one side, simple stage with minimal decor on the other",
        sideA: "Crosses, candles, an altar, maybe incense. The architecture often draws your eye upward. The room itself feels like part of the worship - deliberate, layered, and old.",
        sideB: "Simpler stage setup focused on the band and screens. The room is more of a container than a participant. Decoration is minimal or modern. The focus is on the people, not the space.",
        body: "Some people walk into a cathedral and feel God in the stone. Others walk into a plain room and feel God in the people. The room is not decoration - it is part of how the church communicates what matters to them.",
      },
      {
        title: "The Flow",
        illustration: "https://media.gospelchannel.com/guides/compare-liturgical-vs-free/03-people.png",
        illustrationAlt: "Split scene: congregation standing and sitting in unison on one side, people moving freely around the room on the other",
        sideA: "Stand, sit, kneel, respond - all at set times. The congregation moves together through a known order. You can follow along in a printed liturgy or prayer book. There are no surprises.",
        sideB: "The service has a loose shape but no fixed script. The worship leader or pastor reads the room and adjusts. Some moments are planned, others happen in the moment. You follow the energy.",
        body: "If unpredictability makes you anxious, liturgical flow is calming because you always know what is next. If predictability makes you restless, free worship keeps you present because you never quite know what is coming.",
      },
      {
        title: "Communion",
        illustration: "https://media.gospelchannel.com/guides/compare-liturgical-vs-free/04-sunday.png",
        illustrationAlt: "Split scene: formal communion at an altar rail on one side, bread and cups passed casually through rows on the other",
        sideA: "Usually every week, at a set point in the service. Often at an altar rail or station. The words spoken are ancient and the same each time. It feels like a sacred pause in the middle of everything.",
        sideB: "Frequency varies - some churches do it weekly, others monthly. It might be bread and cups passed through the rows, or stations you walk to. The words are simpler and more conversational.",
        body: "Communion is one of those things that hits different depending on what you need. The formality of liturgical communion makes some people feel connected to centuries of faith. The simplicity of free church communion makes others feel more personally present.",
      },
      {
        title: "The Feel",
        illustration: "https://media.gospelchannel.com/guides/compare-liturgical-vs-free/05-feel.png",
        illustrationAlt: "Split scene: person kneeling in quiet prayer on one side, person with arms raised in spontaneous worship on the other",
        sideA: "Reverent, rhythmic, anchored. The service carries you rather than asking you to generate energy. Some people find this deeply restful. Others find it distant at first.",
        sideB: "Open, responsive, personal. The service asks more of you emotionally but gives more space to express what you feel. Some people find this freeing. Others find it overwhelming at first.",
        body: "Neither feel is more genuine. Liturgical worship is not cold and free worship is not shallow. The question is which one lets you actually be present instead of performing comfort you do not feel.",
      },
    ],
    quoteA: { text: "I do not have to bring energy. The liturgy holds me. On the weeks I can barely get through the door, the prayers carry me when I have no words of my own." },
    quoteB: { text: "When the worship leader went off script and just started praying, I cried for the first time in years. I did not know I needed that until it happened." },
    nudge: "If you are torn, try one of each. You will know quickly which one lets you breathe. And many churches sit somewhere in between these two poles.",
    ctaA: { label: "Browse liturgical churches", href: "/church/denomination/anglican" },
    ctaB: { label: "Browse free worship churches", href: "/church/style/charismatic" },
    faq: [
      { question: "Does liturgical mean boring?", answer: "No. Liturgical worship has rhythm, beauty, and depth. It can feel deeply moving once you learn the flow. Many people find it more engaging over time, not less." },
      { question: "Does free worship mean anything goes?", answer: "No. Good free worship churches are still led with care and intention. The freedom is in the room to respond, not in a lack of direction." },
      { question: "What if I like structure but also want some spontaneity?", answer: "Many churches blend elements of both. Anglican churches with contemporary music, or charismatic churches with communion liturgy. You do not have to pick one extreme." },
    ],
  },

  /* ---- Big Church vs Small Church ---- */
  {
    slug: "big-church-vs-small-church",
    eyebrow: "Compare Guide",
    title: "Big Church vs Small Church",
    intro: "This is not about which is better. It is about what you need right now - room to breathe, or a place where people know your name.",
    labelA: "Big Church",
    labelB: "Small Church",
    aspects: [
      {
        title: "The Sound",
        illustration: "https://media.gospelchannel.com/guides/compare-big-vs-small/01-sound.png",
        illustrationAlt: "Split scene: large worship band on a big stage on one side, single guitarist leading a small room on the other",
        sideA: "Full band, strong production, polished sound. Multiple vocalists, in-ear monitors, a sound team running the mix. The music often sounds close to a studio recording. You can sing without anyone hearing you.",
        sideB: "Smaller band or just a single musician. The sound is more raw and the room is quieter. You can hear individual voices around you. Your own singing is more noticeable.",
        body: "If you want to disappear into the music, a bigger room makes that easy. If you want to feel like your voice is part of the sound, a smaller room gives you that. Both are real worship - just different acoustics.",
      },
      {
        title: "The Room",
        illustration: "https://media.gospelchannel.com/guides/compare-big-vs-small/02-room.png",
        illustrationAlt: "Split scene: large auditorium with hundreds of seats on one side, cozy room with a few dozen chairs on the other",
        sideA: "Hundreds or thousands of seats. Professional lighting, big screens, a welcome team in matching shirts. Parking lots, kids check-in systems, maybe a cafe. It can feel like walking into an event.",
        sideB: "A few dozen to a hundred people. Simpler setup - maybe a rented hall, a converted house, or a small chapel. You might shake the pastor's hand on the way in. It feels more like a gathering.",
        body: "Big churches invest in making the first visit easy - clear signage, greeters, systems. Small churches invest in making you feel seen. Depending on where you are, one of those matters more right now.",
      },
      {
        title: "The People",
        illustration: "https://media.gospelchannel.com/guides/compare-big-vs-small/03-people.png",
        illustrationAlt: "Split scene: person blending into a large crowd on one side, small group having coffee together on the other",
        sideA: "You can be anonymous for as long as you want. Nobody will notice if you slip in late or leave early. Community happens through small groups, volunteer teams, or programs - not automatically.",
        sideB: "People will notice you and probably introduce themselves. Anonymity is harder. Community happens faster, but so does social pressure. If you miss a week, someone might ask where you were.",
        body: "Some people need weeks of anonymity before they are ready to connect. Others need someone to say their name on week one. Be honest about which one you are right now. You can always switch later.",
      },
      {
        title: "A Typical Sunday",
        illustration: "https://media.gospelchannel.com/guides/compare-big-vs-small/04-sunday.png",
        illustrationAlt: "Split scene: large church lobby with check-in kiosks on one side, people chatting in a simple foyer on the other",
        sideA: "Multiple services, kids programs by age group, a polished worship set, a well-rehearsed sermon, clear start and end times. Everything runs on a schedule. You can show up, experience it, and leave without any friction.",
        sideB: "One service, maybe one kids option or all-ages together. The sermon might run long if the conversation gets good. After the service, people linger. Leaving quickly is harder without it feeling noticeable.",
        body: "Big churches are designed for a smooth visitor experience. Small churches are designed for a deep community rhythm. The first is easier to try. The second is easier to belong to.",
      },
      {
        title: "The Tradeoff",
        illustration: "https://media.gospelchannel.com/guides/compare-big-vs-small/05-feel.png",
        illustrationAlt: "Split scene: person sitting peacefully alone in a large room on one side, person being hugged by church members on the other",
        sideA: "You get space, polish, and options - but you have to work harder to find real community. A big church will not chase you. You have to opt in to being known.",
        sideB: "You get warmth, speed-to-belonging, and a more personal pastor relationship - but less programming, less anonymity, and sometimes less polish in the service.",
        body: "Neither tradeoff is wrong. The question is what you need more right now: room to explore at your own pace, or a place that pulls you in before you are ready to ask.",
      },
    ],
    quoteA: { text: "I needed a place where nobody knew my story yet. The big church let me just sit and listen for three months before I talked to anyone. That space saved me." },
    quoteB: { text: "The pastor called me by name on my second visit. I had never had that before. It felt like someone was actually glad I showed up." },
    nudge: "There is no universally better size. The right church is the one you will actually go back to. If you are not sure, try one of each and see where you exhale.",
    ctaA: { label: "Browse larger churches", href: "/church/style/contemporary-worship" },
    ctaB: { label: "Browse smaller churches", href: "/church/style/acoustic" },
    faq: [
      { question: "How big is a 'big church'?", answer: "There is no strict number. Generally, 500+ on a Sunday feels big. Over 2,000 is often called a megachurch. But the feel of a church matters more than the headcount." },
      { question: "Can I find community at a big church?", answer: "Yes, but you usually have to join a small group, serve on a team, or attend a midweek gathering. Community at a big church is opt-in, not automatic." },
      { question: "Are small churches less professional?", answer: "Sometimes the production is simpler, but that does not mean less quality. Many small churches have excellent teaching, warm worship, and strong pastoral care." },
    ],
  },
];

export function getCompareGuideContent(slug: string): CompareGuideContent | undefined {
  return COMPARE_GUIDE_CONTENT.find((g) => g.slug === slug);
}
