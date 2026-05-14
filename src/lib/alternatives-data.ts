export type CellState = "yes" | "no" | "partial" | "text";

export type ComparisonCell = {
  state: CellState;
  note?: string;
};

export type ComparisonRow = {
  feature: string;
  yours: ComparisonCell;
  theirs: ComparisonCell;
};

export type SwitchReason = {
  title: string;
  body: string;
};

export type HonestyRow = {
  feature: string;
  body: string;
};

export type AlternativeFAQ = {
  question: string;
  answer: string;
};

export type AlternativeData = {
  slug: string;
  competitor_name: string;
  competitor_url: string;

  meta_title: string;
  meta_description: string;

  hero_eyebrow: string;
  hero_h1: string;
  hero_lede: string;

  table_h2: string;
  table_lede: string;
  comparison_rows: ComparisonRow[];

  switch_h2: string;
  switch_lede: string;
  switch_reasons: SwitchReason[];

  honesty_h2: string;
  honesty_lede: string;
  honesty_rows: HonestyRow[];

  faq_h2: string;
  faqs: AlternativeFAQ[];

  cta_h2: string;
  cta_lede: string;
};

export const ALTERNATIVES: Record<string, AlternativeData> = {
  churchfinder: {
    slug: "churchfinder",
    competitor_name: "ChurchFinder.com",
    competitor_url: "https://www.churchfinder.com",

    meta_title: "ChurchFinder.com Alternative — GospelChannel (free, global)",
    meta_description:
      "GospelChannel is a free, global ChurchFinder.com alternative: 72,000+ gospel- and worship-focused churches with Spotify playlists on every profile.",

    hero_eyebrow: "ChurchFinder.com alternative",
    hero_h1: "Looking for a ChurchFinder.com alternative?",
    hero_lede:
      "GospelChannel is the gospel- and worship-focused church directory ChurchFinder.com isn't. You get 72,000+ churches across 104 countries, Spotify and YouTube on every profile, and filters that actually match worship style — not just denomination.",

    table_h2: "Best ChurchFinder.com alternatives in 2026",
    table_lede:
      "ChurchFinder.com is the largest general directory in the United States, but the experience has aged and there is no real way to hear what a Sunday actually sounds like. Here is how GospelChannel compares on what most first-time visitors care about.",
    comparison_rows: [
      {
        feature: "Price",
        yours: { state: "text", note: "Free for visitors and churches" },
        theirs: { state: "text", note: "Free for visitors; paid plans for churches" },
      },
      {
        feature: "Free for churches to claim and edit",
        yours: { state: "yes" },
        theirs: { state: "partial", note: "Limited free tier" },
      },
      {
        feature: "Spotify playlists on church profiles",
        yours: { state: "yes", note: "Every claimable church" },
        theirs: { state: "no" },
      },
      {
        feature: "YouTube video grid on church profiles",
        yours: { state: "yes" },
        theirs: { state: "no" },
      },
      {
        feature: "Filter by worship style",
        yours: { state: "yes", note: "Contemporary, gospel, charismatic, etc." },
        theirs: { state: "no" },
      },
      {
        feature: "Filter by language",
        yours: { state: "yes" },
        theirs: { state: "no" },
      },
      {
        feature: "Number of churches",
        yours: { state: "text", note: "72,000+ globally" },
        theirs: { state: "text", note: "~280,000 (US-heavy)" },
      },
      {
        feature: "Countries covered",
        yours: { state: "text", note: "104" },
        theirs: { state: "text", note: "Primarily United States" },
      },
      {
        feature: "Prayer wall",
        yours: { state: "yes" },
        theirs: { state: "no" },
      },
      {
        feature: "Open data for AI search",
        yours: { state: "yes", note: "llms.txt + structured data" },
        theirs: { state: "no" },
      },
      {
        feature: "Visitor-friendly first-visit guides",
        yours: { state: "yes" },
        theirs: { state: "partial" },
      },
      {
        feature: "Mobile-first design from 2026",
        yours: { state: "yes" },
        theirs: { state: "partial", note: "Older UI patterns" },
      },
    ],

    switch_h2: "Why people switch from ChurchFinder.com",
    switch_lede:
      "Three things keep coming up when church-seekers tell us why GospelChannel works better for them than ChurchFinder.com — and none of them are about which directory is bigger.",
    switch_reasons: [
      {
        title: "Hear the worship before you walk in",
        body:
          "Every church profile pulls in the church's own Spotify playlists and YouTube videos. Before you set an alarm for Sunday morning you can actually hear whether the worship is contemporary, gospel, charismatic, hymn-based, or something else. No other free directory does this — and it changes how quickly visitors find a fit.",
      },
      {
        title: "Filter by worship style, not just denomination",
        body:
          "Two non-denominational churches three blocks apart can feel completely different on a Sunday. GospelChannel lets you slice the directory by worship style and language alongside denomination, so a visitor looking for a Hillsong-style service in their city does not have to wade through twenty profiles that match on denomination alone.",
      },
      {
        title: "Global free-church coverage, not US-only",
        body:
          "ChurchFinder.com is excellent for the United States but thins out fast as soon as you cross a border. GospelChannel covers 72,000+ churches across 104 countries with a deliberate focus on free-church, evangelical, and charismatic congregations — useful for expats, students abroad, and anyone moving for work or studies.",
      },
      {
        title: "A directory that's actually nice to spend time in",
        body:
          "Most church-finders feel like a yellow-pages lookup. GospelChannel is built to be a place you'd want to linger on — clean typography, real photography, sound on every page. Pastors who claim their profile get a flow that feels closer to editing a Notion page than filing paperwork.",
      },
    ],

    honesty_h2: "Where ChurchFinder.com still wins",
    honesty_lede:
      "ChurchFinder.com has been around since 2007 and there are real reasons people use it instead of us. Here are the places we won't pretend we've caught up.",
    honesty_rows: [
      {
        feature: "Total US church count",
        body:
          "ChurchFinder.com lists roughly 280,000 churches, most of them in the United States. We list 72,000+ globally with strong but not exhaustive US coverage. If you're hunting for a specific small-town congregation in rural America, they have the wider net.",
      },
      {
        feature: "Coverage across all Christian traditions",
        body:
          "We focus on the gospel- and worship-oriented free-church segment — evangelical, charismatic, Pentecostal, non-denominational, Baptist, Vineyard, and similar. If you're specifically looking for a Catholic parish, an Orthodox church, or a state-church congregation (like Svenska Kyrkan or Church of England), ChurchFinder.com is the better starting point.",
      },
      {
        feature: "Pastor-facing tools beyond a profile",
        body:
          "ChurchFinder.com has been building pastor-side features for nearly two decades — paid plans with extra promotion, integrations, and add-ons. We deliberately keep church profiles free and visitor-facing, so if you're a pastor looking for a full marketing suite, theirs is more mature.",
      },
      {
        feature: "Established brand recognition in the US",
        body:
          "If your congregation already knows ChurchFinder.com, recommending it is a smaller leap than introducing a new directory. We're still earning that recognition outside the small group of people who've heard about us — fair tradeoff for being newer.",
      },
    ],

    faq_h2: "ChurchFinder.com alternative FAQ",
    faqs: [
      {
        question: "Is GospelChannel free?",
        answer:
          "Yes. GospelChannel is free for visitors to browse and free for churches to claim and edit their profile. There are no paid tiers — the whole directory is open. We may add optional paid promotion features for churches later, but the core directory will stay free.",
      },
      {
        question: "How is GospelChannel different from ChurchFinder.com?",
        answer:
          "Two big differences. First, every GospelChannel profile pulls in Spotify playlists and YouTube videos, so you can actually hear the worship before you visit. Second, our focus is the global free-church, evangelical, charismatic, and gospel-worship segment — not every Christian tradition. ChurchFinder is broader and more US-centric.",
      },
      {
        question: "Does GospelChannel cover Catholic or Orthodox churches?",
        answer:
          "Our database can contain entries from any tradition, but our positioning, copy, and SEO is built around the free-church segment — evangelical, charismatic, Pentecostal, Baptist, non-denominational, Vineyard, and similar. If you're specifically searching for a Catholic mass or an Orthodox liturgy, you'll likely have a better experience on ChurchFinder.com or a denomination-specific directory.",
      },
      {
        question: "Can my church get listed on GospelChannel for free?",
        answer:
          "Yes. If your church is in our database you can claim and edit your profile for free at any time — add service times, playlists, photos, what to expect on a first visit. If your church is not yet listed, you can submit it via /church/suggest and we'll review and publish it.",
      },
      {
        question: "Why does GospelChannel show Spotify and YouTube content?",
        answer:
          "Because the easiest way to know whether a church fits is to hear what their Sunday actually sounds like. Worship style varies enormously between two churches that look identical on paper. Showing the church's own playlists and videos lets visitors decide in 30 seconds instead of guessing from a denomination tag.",
      },
      {
        question: "Is GospelChannel available outside the United States?",
        answer:
          "Yes. We list 72,000+ churches across 104 countries with strong coverage across Europe, the Americas, and parts of Asia and Africa. ChurchFinder.com is largely US-focused, which is why expats, international students, and people moving between countries often find GospelChannel easier to use abroad.",
      },
    ],

    cta_h2: "Ready to find your Sunday?",
    cta_lede:
      "Browse the directory, take the church fit quiz, or jump straight to your country, city, or worship style.",
  },
};
