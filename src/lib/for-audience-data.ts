export type PainPoint = {
  title: string;
  body: string;
};

export type SolutionPoint = {
  title: string;
  body: string;
  href: string;
  cta: string;
};

export type CuratedCard = {
  title: string;
  subtitle?: string;
  description: string;
  href: string;
};

export type AudienceFAQ = {
  question: string;
  answer: string;
};

export type ForAudienceData = {
  slug: string;
  audience_name: string;

  meta_title: string;
  meta_description: string;

  hero_eyebrow: string;
  hero_h1: string;
  hero_lede: string;

  pain_h2: string;
  pain_lede: string;
  pains: PainPoint[];

  solution_h2: string;
  solution_lede: string;
  solutions: SolutionPoint[];

  curated_h2: string;
  curated_lede: string;
  curated_cards: CuratedCard[];

  related_guides: Array<{ href: string; label: string }>;
  related_siblings: Array<{ href: string; label: string }>;

  faq_h2: string;
  faqs: AudienceFAQ[];

  cta_h2: string;
  cta_lede: string;
};

export const FOR_AUDIENCE: Record<string, ForAudienceData> = {
  expats: {
    slug: "expats",
    audience_name: "Expats",

    meta_title: "English-Speaking Churches Abroad — GospelChannel for Expats",
    meta_description:
      "Find an English-speaking, free-church or evangelical congregation in your new country. Global directory of 72,000+ churches across 104 countries.",

    hero_eyebrow: "For expats",
    hero_h1: "Find an English-speaking church in your new country",
    hero_lede:
      "Moving abroad is hard enough. Finding a church that speaks your language and feels like home shouldn't add to the load. GospelChannel covers 72,000+ free-church congregations across 104 countries — filter by language, denomination, and worship style to find one that fits before your first Sunday in a new city.",

    pain_h2: "The Sunday morning expats already know",
    pain_lede:
      "Most church-finders assume you live where you were born. They're built for people who already speak the local language and know the local denominations. Expats hit a different set of problems.",
    pains: [
      {
        title: "Service times in a language you don't read yet",
        body:
          "You just moved to Berlin, Madrid, or Tokyo. Local church websites are in German, Spanish, or Japanese. Google Translate mangles the schedule. You don't know whether the 11:00 service is for kids or for everyone, and you don't know who to ask. The next Sunday slips by and you're still not anywhere.",
      },
      {
        title: "Denomination labels that don't translate",
        body:
          "Back home you might have called yourself charismatic, non-denominational, or free evangelical. Abroad, the local Christian landscape is shaped differently. \"Evangelisch\" means something different in Germany than \"evangelical\" does in the US. \"Free Church\" is a category in the UK and a label nobody uses in France. Without a shared map, picking the right Sunday is guesswork.",
      },
      {
        title: "No way to hear the worship before you visit",
        body:
          "An expat trying a new church has more on the line than a local. You don't have time to wander between four congregations until one feels right. You want to know — before you set the alarm — whether the worship is contemporary, gospel, charismatic, or a traditional hymn service. Most directories give you a denomination tag and call it good.",
      },
      {
        title: "Other expats and English-friendly congregations are scattered",
        body:
          "There usually is an English-speaking or English-friendly church in your new city. There's also usually an international fellowship. They're rarely easy to find from a generic directory that treats your country as one bucket — and they don't always show up on the local church-finder, which is built for native speakers.",
      },
    ],

    solution_h2: "How GospelChannel helps expats land softer",
    solution_lede:
      "GospelChannel is built to be filterable across language, country, denomination, and worship style — exactly the dimensions expats actually need on day three in a new country.",
    solutions: [
      {
        title: "Filter by language",
        body:
          "Every church profile has a language field. Filter the directory to English (or any other language you read) and the noise drops by 90% in non-English countries. You'll see English-speaking congregations and international fellowships first, instead of digging through hundreds of native-language results.",
        href: "/church",
        cta: "Browse the directory",
      },
      {
        title: "Browse by country, then narrow by city",
        body:
          "Pick the country you've moved to and we surface every listed church across that country. Drill in to your specific city to see what's actually nearby. Works equally well in Berlin, Buenos Aires, Bangkok, and Bristol — global coverage is the point.",
        href: "/church/country",
        cta: "Browse countries",
      },
      {
        title: "Hear the worship before Sunday",
        body:
          "Church profiles have built-in support for the church's own Spotify playlists and YouTube videos. Coverage is growing and a meaningful share of profiles already have music or video attached. When it's there, you can hear whether the worship is contemporary, gospel, charismatic, or hymn-based before you commit to a service time.",
        href: "/church/style",
        cta: "Browse worship styles",
      },
      {
        title: "Built around free-church traditions",
        body:
          "If you grew up evangelical, charismatic, Pentecostal, non-denominational, Baptist, or Vineyard, GospelChannel is positioned around those traditions worldwide. You don't have to translate your background into a local state-church or Catholic frame — the directory speaks free-church natively across borders.",
        href: "/church/denomination",
        cta: "Browse denominations",
      },
    ],

    curated_h2: "English-speaking expat communities, country by country",
    curated_lede:
      "A starting point for some of the countries where English-speaking and international free-church congregations are common. Each country page lists every church we know about there — then narrow by city, denomination, or worship style.",
    curated_cards: [
      {
        title: "Germany",
        subtitle: "Berlin, Munich, Frankfurt",
        description:
          "International fellowships in the big cities plus historic free-church congregations across the country. Filter to English to find expat-friendly options.",
        href: "/church/country/germany",
      },
      {
        title: "France",
        subtitle: "Paris, Lyon, Marseille",
        description:
          "A handful of well-established English-speaking evangelical congregations in Paris and pockets of free-church life across France.",
        href: "/church/country/france",
      },
      {
        title: "Spain",
        subtitle: "Madrid, Barcelona, Valencia",
        description:
          "Growing international congregations and free-church communities — both English-speaking and bilingual options worth a Sunday.",
        href: "/church/country/spain",
      },
      {
        title: "Netherlands",
        subtitle: "Amsterdam, The Hague, Rotterdam",
        description:
          "Long-running English-speaking churches in the major cities, including international congregations that serve diplomatic and corporate expat communities.",
        href: "/church/country/netherlands",
      },
      {
        title: "Switzerland",
        subtitle: "Zurich, Geneva, Basel",
        description:
          "International congregations in the financial hubs and English services across the country. Good language coverage relative to size.",
        href: "/church/country/switzerland",
      },
      {
        title: "Singapore",
        subtitle: "City-state",
        description:
          "Strong free-church and evangelical scene in English, with megachurches and smaller congregations side by side. Easy starting point for new arrivals.",
        href: "/church/country/singapore",
      },
      {
        title: "Japan",
        subtitle: "Tokyo, Osaka, Yokohama",
        description:
          "International and bilingual congregations cluster in the big cities. Smaller numbers overall but the English-speaking options are well-documented.",
        href: "/church/country/japan",
      },
      {
        title: "Sweden",
        subtitle: "Stockholm, Gothenburg, Malmö",
        description:
          "Growing English-speaking free-church and charismatic communities — especially in Stockholm — alongside the historic Pingst (Pentecostal) and EFK networks.",
        href: "/church/country/sweden",
      },
    ],

    related_guides: [
      { href: "/guides/first-visit-guide", label: "First visit guide" },
      { href: "/guides/church-fit-quiz", label: "Church fit quiz" },
      { href: "/guides/worship-style-match", label: "Worship style match" },
    ],
    related_siblings: [],

    faq_h2: "Expat church-finding FAQ",
    faqs: [
      {
        question: "Does GospelChannel only list English-speaking churches?",
        answer:
          "No. We list churches in any language a congregation reports — the directory is global. The language filter is what lets expats narrow to English-speaking options specifically. If you read other languages, you can filter on those too.",
      },
      {
        question: "How do I find an English-speaking church in a non-English country?",
        answer:
          "Open the country page (for example /church/country/germany) and filter by language to English, or use the language tag on individual church profiles. You'll see English-speaking churches and international fellowships first, instead of having to wade through hundreds of native-language results.",
      },
      {
        question: "Is GospelChannel free to use abroad?",
        answer:
          "Yes. The directory is free to browse from anywhere in the world. No paywall, no signup required, and no regional restrictions. Pastors of free-church congregations can also claim and edit their profile for free, wherever the church is located.",
      },
      {
        question: "What kinds of churches does GospelChannel focus on?",
        answer:
          "Our positioning is free-church, evangelical, charismatic, Pentecostal, non-denominational, Baptist, Vineyard, and similar gospel- and worship-oriented traditions. If you're looking specifically for Catholic mass, Orthodox liturgy, or state-church services, a denomination-specific directory will fit your need better.",
      },
      {
        question: "Do you have coverage in [my country]?",
        answer:
          "We cover 72,000+ churches across 104 countries with strong coverage in Europe, the Americas, and parts of Asia and Africa. Coverage isn't even — some countries have hundreds of churches indexed, others only a handful. If you can't find what you need, you can suggest a church via /church/suggest and we'll review it.",
      },
      {
        question: "Will I find an international church or just a translated local one?",
        answer:
          "Both. International congregations (often English-language by default, multinational membership) are a distinct kind of church and many of them are listed. Local churches that happen to offer an English-language service are also listed. The language filter doesn't distinguish between the two — start with that filter, then read individual profiles to find the right vibe.",
      },
    ],

    cta_h2: "Land softer in your new country",
    cta_lede:
      "Start with the country page, filter to English, and you'll usually have a Sunday plan inside ten minutes.",
  },
};
