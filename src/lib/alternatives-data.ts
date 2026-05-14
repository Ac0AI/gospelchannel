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
      "GospelChannel is a free, global ChurchFinder.com alternative: 72,000+ gospel- and worship-focused churches with built-in Spotify and YouTube support.",

    hero_eyebrow: "ChurchFinder.com alternative",
    hero_h1: "Looking for a ChurchFinder.com alternative?",
    hero_lede:
      "GospelChannel is the gospel- and worship-focused church directory ChurchFinder.com isn't. You get 72,000+ churches across 104 countries, built-in Spotify and YouTube support on church profiles (with growing coverage), and filters that actually match worship style — not just denomination.",

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
        yours: { state: "yes", note: "Built-in; growing coverage" },
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
          "Church profiles can pull in the church's own Spotify playlists and YouTube videos — coverage is growing and a meaningful share of profiles already have it. Before you set an alarm for Sunday morning you can often hear whether the worship is contemporary, gospel, charismatic, hymn-based, or something else. No other free directory has this kind of music integration built in at all.",
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
          "Two big differences. First, GospelChannel profiles have built-in support for the church's own Spotify playlists and YouTube videos so you can actually hear the worship before you visit — coverage is growing and many profiles already include it. Second, our focus is the global free-church, evangelical, charismatic, and gospel-worship segment — not every Christian tradition. ChurchFinder is broader and more US-centric.",
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

  "gospel-coalition": {
    slug: "gospel-coalition",
    competitor_name: "The Gospel Coalition",
    competitor_url: "https://www.thegospelcoalition.org/churches",

    meta_title: "Gospel Coalition Directory Alternative — GospelChannel",
    meta_description:
      "A free, broader Gospel Coalition Church Directory alternative — 72,000+ free-church congregations across 104 countries, no Reformed-only filter.",

    hero_eyebrow: "The Gospel Coalition alternative",
    hero_h1: "Looking for a Gospel Coalition Church Directory alternative?",
    hero_lede:
      "GospelChannel is the broader, music-aware church directory for people who like The Gospel Coalition's mission but don't want a Reformed-only filter. Free, global, 72,000+ free-church congregations, with built-in Spotify and YouTube support and worship-style filtering.",

    table_h2: "Best Gospel Coalition Church Directory alternatives in 2026",
    table_lede:
      "The Gospel Coalition's directory is a small, hand-vetted list of Reformed and Reformed-leaning churches. GospelChannel is wider, more music-led, and covers the whole free-church spectrum. Here's how the two compare.",
    comparison_rows: [
      {
        feature: "Price",
        yours: { state: "text", note: "Free for visitors and churches" },
        theirs: { state: "text", note: "Free to browse" },
      },
      {
        feature: "Theological filter",
        yours: { state: "text", note: "Broad free-church / evangelical / charismatic" },
        theirs: { state: "text", note: "Reformed / Reformed-leaning only" },
      },
      {
        feature: "Number of churches",
        yours: { state: "text", note: "72,000+ globally" },
        theirs: { state: "text", note: "A few thousand, hand-vetted" },
      },
      {
        feature: "Countries covered",
        yours: { state: "text", note: "104" },
        theirs: { state: "text", note: "Primarily United States" },
      },
      {
        feature: "Spotify playlists on church profiles",
        yours: { state: "yes", note: "Built-in; growing coverage" },
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
        feature: "Church can self-claim and edit free",
        yours: { state: "yes" },
        theirs: { state: "partial", note: "Application + vetting required" },
      },
      {
        feature: "First-visit and faith guides",
        yours: { state: "yes", note: "5 guides, no signup" },
        theirs: { state: "yes", note: "Article archive" },
      },
      {
        feature: "Prayer wall",
        yours: { state: "yes" },
        theirs: { state: "no" },
      },
      {
        feature: "Open data for AI search (llms.txt)",
        yours: { state: "yes" },
        theirs: { state: "no" },
      },
    ],

    switch_h2: "Why people use GospelChannel alongside The Gospel Coalition",
    switch_lede:
      "Most people don't actually pick one or the other — they read The Gospel Coalition for content, then use GospelChannel as the directory because the directory itself is built for finding a church, not validating one.",
    switch_reasons: [
      {
        title: "Broader than Reformed",
        body:
          "The Gospel Coalition vets every listed church against a specific Reformed-leaning confessional standard. That's a feature for some readers and a wall for others. GospelChannel is built around the whole free-church segment — Pentecostal, Vineyard, non-denominational, charismatic, Baptist, Reformed, and more — without locking anyone out for being on the wrong side of an internal theological line.",
      },
      {
        title: "Hear the worship before you commit",
        body:
          "TGC's directory tells you a church's confessional position. It does not tell you whether the Sunday service has a piano or an eight-piece band. GospelChannel profiles can carry the church's own Spotify playlists and YouTube videos — coverage is growing, and many profiles already have it — so you can often hear the worship style before you walk in. Useful when two churches share a denomination but feel completely different.",
      },
      {
        title: "Global, not US-shaped",
        body:
          "TGC's church directory is heavily US-centric, with thinner coverage internationally. GospelChannel covers 72,000+ churches across 104 countries with deliberate focus on free-church traditions worldwide. If you're an expat, an international student, or moving abroad for work, you'll find more usable coverage here.",
      },
      {
        title: "Free for churches with no application gauntlet",
        body:
          "Any free-church congregation can claim and edit a GospelChannel profile in minutes — service times, photos, playlists, what a first visit feels like. The Gospel Coalition's directory expects churches to apply and meet a confessional standard before listing. Both approaches make sense; they just optimize for different things.",
      },
    ],

    honesty_h2: "Where The Gospel Coalition still wins",
    honesty_lede:
      "We're not trying to replace what The Gospel Coalition does. They're excellent at things we deliberately don't do. Three places where their directory is the better tool.",
    honesty_rows: [
      {
        feature: "Theological vetting and confessional clarity",
        body:
          "Every church in TGC's directory has been checked against a specific confessional standard. If your search criterion is literally 'a Reformed church that holds to historic creeds', their list is exactly the right shape and ours is too broad. We list across the free-church spectrum without confessional gates.",
      },
      {
        feature: "Editorial brand and ecosystem",
        body:
          "TGC is first a publishing platform — articles, books, conferences — and the directory is part of that ecosystem. Many readers already trust TGC's editorial voice, so a church endorsed by TGC carries weight. We don't have an editorial brand of that depth; we're a directory first.",
      },
      {
        feature: "Reformed conference and content discovery",
        body:
          "If you're trying to find Reformed conferences, podcasts, or thinkers alongside finding a church, TGC's directory is embedded in a larger ecosystem that connects all of those. GospelChannel is laser-focused on the directory — we point you to a church, not to a constellation of resources around it.",
      },
    ],

    faq_h2: "Gospel Coalition Church Directory alternative FAQ",
    faqs: [
      {
        question: "Is GospelChannel a Reformed church directory?",
        answer:
          "No. GospelChannel is built around the broader free-church segment — evangelical, charismatic, Pentecostal, non-denominational, Vineyard, Baptist (including Reformed Baptist), and similar. Some Reformed churches are listed but Reformed theology is not a filter or a requirement for inclusion. If you specifically want a Reformed-only directory, The Gospel Coalition is a better starting point.",
      },
      {
        question: "Can I use both GospelChannel and The Gospel Coalition?",
        answer:
          "Yes, and most people do. The Gospel Coalition is strongest as a content platform and a confessional vetted list. GospelChannel is strongest as a global directory with worship-music integration and self-claim profiles. They solve different parts of the same problem and don't conflict.",
      },
      {
        question: "Does GospelChannel vet churches theologically?",
        answer:
          "We verify that a listed entry is in fact a church and that the basic facts (location, contact info, denomination tag) are correct. We do not vet against a specific confession. Visitors evaluate fit themselves using denomination, worship-style filters, playlists, videos, and the church's own profile copy. Pastors who claim their profile can update their tradition, language, and worship style at any time.",
      },
      {
        question: "Why doesn't GospelChannel just adopt TGC's confessional standard?",
        answer:
          "Because we cover free-church traditions that include charismatic, Pentecostal, and non-Reformed evangelical churches that wouldn't pass that standard but are still real congregations worth helping people find. Narrowing to one confession would shrink the directory by an order of magnitude and exclude many of the churches our users are actually looking for.",
      },
      {
        question: "Is GospelChannel free for churches and visitors?",
        answer:
          "Yes. Browsing the directory is free for visitors, and claiming and editing a church profile is free for churches. No paid tiers today; we may add optional paid promotion features later, but the core directory will stay free.",
      },
      {
        question: "Does GospelChannel cover churches outside the United States?",
        answer:
          "Yes. We list 72,000+ churches across 104 countries with strong coverage across Europe, the Americas, and parts of Asia and Africa. The Gospel Coalition's directory is more US-centric, so international visitors and expats often find GospelChannel's coverage more usable.",
      },
    ],

    cta_h2: "Find a church that fits — without a confessional gate",
    cta_lede:
      "Browse the directory, filter by worship style, or take the church fit quiz to find a free-church congregation near you.",
  },

  mychurchfinder: {
    slug: "mychurchfinder",
    competitor_name: "MyChurchFinder",
    competitor_url: "https://mychurchfinder.org",

    meta_title: "MyChurchFinder Alternative — GospelChannel (free, global)",
    meta_description:
      "A free, broader MyChurchFinder alternative: 72,000+ free-church congregations with worship-style filters and built-in Spotify and YouTube support.",

    hero_eyebrow: "MyChurchFinder alternative",
    hero_h1: "Looking for a MyChurchFinder alternative?",
    hero_lede:
      "GospelChannel is the music-led, broader-spectrum church directory for people who want to find a free-church congregation without grading every option against a 45-point theological checklist. Free, global, 72,000+ churches, with built-in Spotify and YouTube support and worship-style filtering.",

    table_h2: "Best MyChurchFinder alternatives in 2026",
    table_lede:
      "MyChurchFinder is opinionated — it grades churches against 45 theological and cultural criteria and ranks accordingly. GospelChannel is wider and music-led: you decide what matters, then filter by worship style, denomination, language, or country. Here is how the two compare.",
    comparison_rows: [
      {
        feature: "Price",
        yours: { state: "text", note: "Free for visitors and churches" },
        theirs: { state: "text", note: "Free to browse" },
      },
      {
        feature: "Approach to fit",
        yours: { state: "text", note: "Filter-driven; visitor decides criteria" },
        theirs: { state: "text", note: "45-point graded score per church" },
      },
      {
        feature: "Theological angle",
        yours: { state: "text", note: "Broad free-church / evangelical" },
        theirs: { state: "text", note: "Opinionated conservative / Reformed-leaning" },
      },
      {
        feature: "Number of churches",
        yours: { state: "text", note: "72,000+ globally" },
        theirs: { state: "text", note: "Smaller, curated US list" },
      },
      {
        feature: "Countries covered",
        yours: { state: "text", note: "104" },
        theirs: { state: "text", note: "Primarily United States" },
      },
      {
        feature: "Spotify playlists on church profiles",
        yours: { state: "yes", note: "Built-in; growing coverage" },
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
        feature: "Church can self-claim and edit free",
        yours: { state: "yes" },
        theirs: { state: "partial" },
      },
      {
        feature: "Prayer wall",
        yours: { state: "yes" },
        theirs: { state: "no" },
      },
      {
        feature: "Open data for AI search (llms.txt)",
        yours: { state: "yes" },
        theirs: { state: "no" },
      },
    ],

    switch_h2: "Why people pick GospelChannel over MyChurchFinder",
    switch_lede:
      "MyChurchFinder optimizes for a very specific kind of theological certainty. GospelChannel optimizes for finding a church you actually want to attend on Sunday. Both are valid; here is why most visitors end up on our side of that line.",
    switch_reasons: [
      {
        title: "You set the criteria, not us",
        body:
          "MyChurchFinder scores every church against 45 fixed theological and cultural criteria, then surfaces the ones that pass. GospelChannel hands you the filters — denomination, worship style, language, country, city — and lets you decide what matters. Useful when your own criteria don't map neatly onto someone else's 45-point grid.",
      },
      {
        title: "Hear the worship before you visit",
        body:
          "A 45-point theological score does not tell you whether the Sunday service has hymns, contemporary worship, gospel choirs, or a Bethel-style set. GospelChannel profiles can carry the church's own Spotify playlists and YouTube videos — coverage is growing, and many already do — so you can often decide in 30 seconds whether the music fits. That's something theological scoring deliberately ignores.",
      },
      {
        title: "Bigger directory, more countries",
        body:
          "MyChurchFinder's strength is depth on a curated US list. GospelChannel covers 72,000+ churches across 104 countries with strong free-church coverage worldwide. If you're moving abroad, studying overseas, or just live somewhere outside the MyChurchFinder catchment area, the wider directory helps.",
      },
      {
        title: "Less ideological friction",
        body:
          "If you're an evangelical, charismatic, or Pentecostal believer who doesn't share every position on MyChurchFinder's grading rubric, their score can make perfectly good churches look 'wrong'. GospelChannel doesn't grade; it lists. You weigh tradition, worship, location, and language yourself — without an algorithm nudging you toward a specific theological camp.",
      },
    ],

    honesty_h2: "Where MyChurchFinder still wins",
    honesty_lede:
      "MyChurchFinder is genuinely useful for a specific audience and we won't pretend they're not. Three places they do something we deliberately don't.",
    honesty_rows: [
      {
        feature: "Explicit theological grading",
        body:
          "If you know exactly what you believe and you want a churchfinder that has already filtered out churches that disagree with you on baptism, eschatology, or complementarianism, MyChurchFinder is built for that. We list across the free-church spectrum and trust visitors to decide for themselves, which means a stricter reader may find our directory too permissive.",
      },
      {
        feature: "Opinionated curation over scale",
        body:
          "MyChurchFinder's smaller, hand-evaluated list reflects deliberate editorial work. Every church has been graded by humans against a fixed rubric. We cover 100× as many churches but with AI-assisted enrichment and pastor self-claims — broader, but with less per-church editorial vetting.",
      },
      {
        feature: "A clear compass for conservative seekers",
        body:
          "MyChurchFinder gives someone deep in a specific Reformed or conservative tradition a clear ranked compass. We deliberately don't take theological positions on a church's behalf, which is liberating for some visitors and frustrating for those who specifically want a curated, opinionated answer.",
      },
    ],

    faq_h2: "MyChurchFinder alternative FAQ",
    faqs: [
      {
        question: "Does GospelChannel grade churches like MyChurchFinder does?",
        answer:
          "No. GospelChannel lists churches and lets visitors filter by tradition, worship style, denomination, language, and location. We don't assign theological scores or rank churches against a fixed rubric. If you want a directory that explicitly grades churches on theology and culture, MyChurchFinder is the right tool for that.",
      },
      {
        question: "Is GospelChannel only for Reformed or conservative evangelicals?",
        answer:
          "No. We cover the broader free-church segment — evangelical, charismatic, Pentecostal, Baptist (including Reformed Baptist), non-denominational, Vineyard, and similar. Some Reformed churches are listed but Reformed theology is not a filter for inclusion. If you want a Reformed- or conservative-only directory, MyChurchFinder or The Gospel Coalition fits better.",
      },
      {
        question: "Is GospelChannel free?",
        answer:
          "Yes. Browsing is free for visitors, and any free-church congregation can claim and edit a profile for free. No paid tiers today. We may add optional paid promotion later, but the core directory stays free.",
      },
      {
        question: "How does GospelChannel handle worship style?",
        answer:
          "Worship style is a primary filter alongside denomination and country. We tag churches by contemporary, gospel, charismatic, traditional, Hillsong-style, Bethel-style, and similar. Church profiles can pull in the church's own Spotify playlists and YouTube videos so you can hear the actual music before you visit — coverage is growing, and many profiles already have it. MyChurchFinder doesn't filter on worship style and doesn't surface church music at all.",
      },
      {
        question: "Can my church get listed on GospelChannel for free?",
        answer:
          "Yes. If your church is already in our database you can claim and edit it for free at any time. If not, you can submit it via /church/suggest and we'll review and publish. We don't gate listing on a theological standard — we list across the free-church spectrum.",
      },
      {
        question: "Does GospelChannel cover churches outside the United States?",
        answer:
          "Yes. We list 72,000+ churches across 104 countries with strong coverage across Europe, the Americas, and parts of Asia and Africa. MyChurchFinder is more US-focused, so international users typically find GospelChannel's coverage more usable abroad.",
      },
    ],

    cta_h2: "Find a church on your terms",
    cta_lede:
      "Filter by what actually matters to you — worship style, language, country, denomination — and hear the music before you visit.",
  },
};
