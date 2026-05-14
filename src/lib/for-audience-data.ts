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

  students: {
    slug: "students",
    audience_name: "Students",

    meta_title: "Gospel Churches Near Campus — GospelChannel for Students",
    meta_description:
      "Find a free-church or evangelical congregation near your university — walkable, student-friendly, with worship that fits your home church back home.",

    hero_eyebrow: "For students",
    hero_h1: "Find a gospel church near your university",
    hero_lede:
      "You moved for university and your home church is now eight hours away. GospelChannel helps you find a walkable free-church or evangelical congregation in your college town, with filters for worship style and language, so the Sunday you skip stops being the rule.",

    pain_h2: "Why students skip church for months without meaning to",
    pain_lede:
      "It's almost never a faith decision. It's the friction of being new in a city, with no car, on a budget, and no idea which of the eight churches near campus actually has people your age.",
    pains: [
      {
        title: "No car, no clue which church is walkable",
        body:
          "Most church-finders show you a 25-mile radius and call it good. You actually need somewhere you can walk or bus to on a Sunday morning when the bike's flat and it's pouring. Without filtering by city you wade through congregations 40 minutes out by car that may as well be in another country.",
      },
      {
        title: "Sunday gets eaten by week-old laundry",
        body:
          "It's not unbelief — it's logistics. You meant to try a church the first weekend; the bin overflowed. Then it was an essay. By week six, walking into a new congregation alone feels harder than skipping. A directory that puts a clear option in front of you takes one excuse off the pile.",
      },
      {
        title: "You're 19 and most of the room is 60",
        body:
          "You find a free-church congregation, you go once, and the youngest person is twenty years older than you. Nobody did anything wrong; it's just not your tribe. There's usually a student-heavy church in any university town — you just can't tell from the church website which one it is.",
      },
      {
        title: "The worship at home doesn't always translate",
        body:
          "You grew up with contemporary worship, gospel, or charismatic. You walk into a 15th-century stone building and there's an organ and three verses of a hymn you've never sung. Both styles are loved by their congregations — they're just not interchangeable, and you can't always tell from outside which a specific Sunday will be. A directory that lets you filter on style saves the guesswork.",
      },
    ],

    solution_h2: "How GospelChannel helps students find a Sunday",
    solution_lede:
      "Four ways the directory shrinks the surface area between you and a church that fits — fast enough that Sunday doesn't slip into Monday again.",
    solutions: [
      {
        title: "Browse by city, not by radius",
        body:
          "Every city we cover has a dedicated page listing churches in that city specifically. Open your university town's page and you immediately see what's actually nearby — no more 30-mile suburbs cluttering the result.",
        href: "/church/city",
        cta: "Browse cities",
      },
      {
        title: "Filter by worship style",
        body:
          "If you grew up with contemporary worship, gospel, charismatic, or Hillsong-style, filter on that and you'll arrive on Sunday already familiar with the sound. Hymn-led, blended, and traditional services are all listed too — useful when you want to try them deliberately, not by accident.",
        href: "/church/style",
        cta: "Browse worship styles",
      },
      {
        title: "Hear the music before you commit",
        body:
          "Church profiles can carry the church's own Spotify playlists and YouTube videos. Coverage is growing and many profiles already have it. Two clicks tells you whether the Sunday set sounds anything like what you sang at home.",
        href: "/church",
        cta: "Open the directory",
      },
      {
        title: "Take the church fit quiz",
        body:
          "Seven questions, no signup, three matches at the end. Useful if you don't know what to look for or what your home church's tradition was technically called. Bring the three matches to whoever recommended you GospelChannel and ask which one to try first.",
        href: "/guides/church-fit-quiz",
        cta: "Take the quiz",
      },
    ],

    curated_h2: "Strong student-and-church cities to start with",
    curated_lede:
      "A few college towns with well-documented student-friendly free-church scenes. Each city page lists every church there — narrow by denomination, worship style, or language from there.",
    curated_cards: [
      {
        title: "Oxford",
        subtitle: "United Kingdom",
        description:
          "Historic university with a long tradition of student churches — a meaningful share of which are evangelical or charismatic and very student-aware.",
        href: "/church/city/oxford",
      },
      {
        title: "Cambridge",
        subtitle: "United Kingdom",
        description:
          "Similar to Oxford — strong CICCU-shaped scene with student-led evangelical congregations alongside the historic college chapels.",
        href: "/church/city/cambridge",
      },
      {
        title: "Edinburgh",
        subtitle: "Scotland, United Kingdom",
        description:
          "Solid mix of Free Church of Scotland, Baptist, and contemporary evangelical communities — many with explicit student work.",
        href: "/church/city/edinburgh",
      },
      {
        title: "Berkeley",
        subtitle: "California, United States",
        description:
          "UC Berkeley sits inside a rich Bay Area church scene with student-focused contemporary and charismatic congregations.",
        href: "/church/city/berkeley",
      },
      {
        title: "Boston",
        subtitle: "Massachusetts, United States",
        description:
          "Dense university region — Boston, Cambridge MA, and the wider Greater Boston area together have a wide free-church offering aimed at students.",
        href: "/church/city/boston",
      },
      {
        title: "Uppsala",
        subtitle: "Sweden",
        description:
          "Sweden's classic university town with growing free-church and charismatic communities, plus English-friendly options for international students.",
        href: "/church/city/uppsala",
      },
      {
        title: "Lund",
        subtitle: "Sweden",
        description:
          "Lund University and the surrounding Skåne region have an active free-church and Pingst presence with student-oriented services.",
        href: "/church/city/lund",
      },
      {
        title: "Heidelberg",
        subtitle: "Germany",
        description:
          "One of Europe's oldest universities sits in a city with English-speaking international fellowships alongside German free-church congregations.",
        href: "/church/city/heidelberg",
      },
    ],

    related_guides: [
      { href: "/guides/church-fit-quiz", label: "Church fit quiz" },
      { href: "/guides/first-visit-guide", label: "First visit guide" },
      { href: "/guides/worship-style-match", label: "Worship style match" },
    ],

    faq_h2: "Student church-finding FAQ",
    faqs: [
      {
        question: "How do I find a church near my university?",
        answer:
          "Open the city page for your university town (for example /church/city/oxford) and browse the churches listed there. You can also filter by worship style, denomination, or language to narrow further. Most user-facing pages are public and don't require signup.",
      },
      {
        question: "Are there churches specifically for students?",
        answer:
          "Some congregations explicitly run student work or are unusually student-heavy; others are mixed-age congregations that students attend alongside everyone else. The directory doesn't have a binary student/non-student flag, but in university cities you can usually spot the student-strong churches from the profile copy and music.",
      },
      {
        question: "Is GospelChannel free for students?",
        answer:
          "Yes. The directory is free to browse, the church fit quiz is free, and there's no paywall. You don't need to sign up to use any of it. If you're a pastor or student leader involved with a church, you can also claim and edit the profile for free.",
      },
      {
        question: "What kinds of churches will I find?",
        answer:
          "Free-church, evangelical, charismatic, Pentecostal, non-denominational, Baptist, Vineyard, and similar gospel- and worship-oriented traditions are the focus. The wider directory also lists congregations from other traditions, but our positioning and filters lean toward the free-church segment that most evangelical students come from.",
      },
      {
        question: "What if my home church's tradition doesn't exist in my college town?",
        answer:
          "It happens — especially in smaller university cities. The fit quiz and worship-style filter help you find the closest match. A Vineyard-style worshipper might land happily at a contemporary non-denominational church even when there's no Vineyard plant in town. Two months trying the closest match beats six months trying nothing.",
      },
    ],

    cta_h2: "Find a Sunday before next Sunday",
    cta_lede:
      "Open your city page, filter to a worship style that fits, and you'll have a short list ready before tomorrow's lecture.",
  },

  "young-adults": {
    slug: "young-adults",
    audience_name: "Young adults",

    meta_title: "Contemporary Worship for Young Adults — GospelChannel",
    meta_description:
      "Find a free-church or non-denominational congregation with contemporary worship, an active 20-something community, and music you actually want to sing.",

    hero_eyebrow: "For young adults",
    hero_h1: "Contemporary worship churches for the 20-something season",
    hero_lede:
      "Your parents' church doesn't quite fit anymore and the campus ministry shut for the summer. GospelChannel helps you find a contemporary or charismatic free-church congregation with people in your stage of life — and you can hear the worship before you commit to a Sunday.",

    pain_h2: "The 20-something church gap",
    pain_lede:
      "There's a real life-stage gap between leaving home and settling into a family church. Most directories don't help you bridge it.",
    pains: [
      {
        title: "Parents' church doesn't fit the season anymore",
        body:
          "The congregation that raised you is still good — it's just not yours right now. The music is the music you sang at fifteen. The community is the people your parents drink coffee with. You need somewhere that meets you where you actually live, not where you used to.",
      },
      {
        title: "Most directories surface family churches first",
        body:
          "Generic church-finders implicitly optimize for families because that's their primary audience. The contemporary, charismatic, or young-adult-heavy congregations in your city are there too, but you have to hunt. The directory should be able to tell you where the 20-somethings actually go.",
      },
      {
        title: "Different worship styles fit different seasons",
        body:
          "There's a real difference between a traditional hymn service and a fully-produced contemporary worship set — both are loved by real people, and neither is wrong. The challenge is that a church website rarely makes it obvious which end of that range a specific Sunday lands at. Visiting blind costs a Sunday you'd rather spend at the right fit.",
      },
      {
        title: "Loneliness compounds when you keep trying and bouncing",
        body:
          "Trying three new churches in three weeks and not staying anywhere is harder than not going at all. Each visit you arrive alone, leave alone, and don't go back. A directory that points you at congregations with active 20-something communities saves the third strike.",
      },
    ],

    solution_h2: "How GospelChannel helps you find your tribe",
    solution_lede:
      "Filter by the dimensions that actually matter at this stage — worship style first, denomination second, location third — and use the music previews to skip the visits that wouldn't have worked.",
    solutions: [
      {
        title: "Filter by worship style first",
        body:
          "Contemporary, gospel, charismatic, Hillsong-style, Bethel-style, hymn-led, blended — pick the sound that matches what you actually want to sing on Sunday morning. None is better than the others; the directory just helps you start at the style that fits.",
        href: "/church/style",
        cta: "Browse worship styles",
      },
      {
        title: "Filter by free-church denominations",
        body:
          "Non-denominational, Vineyard, Pentecostal, charismatic — the traditions that tend to skew younger and have stronger contemporary worship. Useful when you already know roughly the family of churches you're looking for.",
        href: "/church/denomination",
        cta: "Browse denominations",
      },
      {
        title: "Hear the music before you visit",
        body:
          "Church profiles can carry the church's own Spotify playlists and YouTube videos. Coverage is growing and many already do. Two clicks and you know whether the Sunday set is what you'd actually put on at home.",
        href: "/church",
        cta: "Open the directory",
      },
      {
        title: "Take the fit quiz",
        body:
          "Seven questions, no signup, three matches at the end. Designed for people who know roughly what they want but haven't translated it into a denomination tag yet.",
        href: "/guides/church-fit-quiz",
        cta: "Take the quiz",
      },
    ],

    curated_h2: "Starting points for the contemporary-worship season",
    curated_lede:
      "Six worship-style and denomination pages where 20-somethings tend to land. Each links to every church we have in that category — narrow by city or country from there.",
    curated_cards: [
      {
        title: "Contemporary worship",
        description:
          "Full-band modern worship — covering the Hillsong, Bethel, and Elevation lineages all in one umbrella. The default sound for most 20-something free-church congregations.",
        href: "/church/style/contemporary-worship",
      },
      {
        title: "Gospel worship",
        description:
          "Black-church-rooted gospel, traditional and contemporary gospel choirs, soulful expressive worship. Strong in US cities and growing internationally.",
        href: "/church/style/gospel",
      },
      {
        title: "Charismatic worship",
        description:
          "Spirit-led, expressive, often spontaneous worship — covers Vineyard, Hillsong, Bethel, and the wider charismatic networks.",
        href: "/church/style/charismatic",
      },
      {
        title: "High-energy worship",
        description:
          "Christian rock-influenced services and the louder end of contemporary worship — driving guitars, strong build-and-release, concert-style production.",
        href: "/church/style/rock",
      },
      {
        title: "Charismatic denominations",
        description:
          "Hillsong Network, Vineyard, C3, Newfrontiers, Bethel, and the wider charismatic networks all grouped together as a denomination filter.",
        href: "/church/denomination/charismatic",
      },
      {
        title: "Non-denominational churches",
        description:
          "Free-church congregations without a formal denominational affiliation. Often skew younger and lean into contemporary worship by default.",
        href: "/church/denomination/non-denominational",
      },
    ],

    related_guides: [
      { href: "/guides/worship-style-match", label: "Worship style match" },
      { href: "/guides/church-fit-quiz", label: "Church fit quiz" },
      { href: "/guides/first-visit-guide", label: "First visit guide" },
    ],

    faq_h2: "Young-adult church-finding FAQ",
    faqs: [
      {
        question: "What's the difference between contemporary, charismatic, and Hillsong-style worship?",
        answer:
          "Contemporary is the broad category — full-band worship, modern songs, usually with screens and lighting. Charismatic is more about expressiveness and openness to the Spirit (raised hands, prophecy, prayer for healing) and often overlaps with contemporary musically. Hillsong-style is a specific lineage of contemporary worship with a recognizable sound and stage culture, often inside the Hillsong Network. /guides/worship-style-match walks through the differences in more detail.",
      },
      {
        question: "Will I find churches that are mostly 20-somethings?",
        answer:
          "In big cities and university towns, yes — there are congregations where the room skews heavily 20-30 and the programming reflects that. In smaller cities the picture is more mixed-age. Filtering by worship style (contemporary, charismatic, Hillsong-style) is the best proxy for finding the congregations young adults already chose.",
      },
      {
        question: "Is GospelChannel free?",
        answer:
          "Yes. Browsing is free, the fit quiz is free, no signup required. Pastors of free-church congregations can claim and edit profiles for free too. There are no paid tiers today.",
      },
      {
        question: "Does GospelChannel only cover Reformed evangelical churches?",
        answer:
          "No. We cover the broad free-church segment — evangelical, charismatic, Pentecostal, non-denominational, Baptist, Vineyard, and Reformed Baptist. Reformed-only directories like The Gospel Coalition are stronger if you specifically want a confessionally vetted list.",
      },
      {
        question: "What if I'm between worship styles?",
        answer:
          "Most young adults are, especially right after leaving a home or campus church. The fit quiz is designed for that — it surfaces a few candidate styles rather than forcing a single answer, and you can try churches across more than one style and decide as you go.",
      },
    ],

    cta_h2: "Find a Sunday that fits the season",
    cta_lede:
      "Start with a worship style, narrow by city, listen before you visit. You'll know in two clicks whether a Sunday is worth trying.",
  },

  families: {
    slug: "families",
    audience_name: "Families",

    meta_title: "Family-Friendly Evangelical Churches — GospelChannel",
    meta_description:
      "Find a family-friendly free-church or evangelical congregation with kids ministry, age-appropriate programs, and a welcoming community for parents.",

    hero_eyebrow: "For families",
    hero_h1: "Find a family-friendly evangelical church",
    hero_lede:
      "When you have kids, picking a church involves more than picking the worship. You're picking the people they'll grow up around, the kids ministry that runs in parallel to the service, and the parents you'll text on Saturday night about Sunday plans. GospelChannel helps you find a free-church or evangelical congregation that fits the whole household.",

    pain_h2: "The family church-search problem",
    pain_lede:
      "Most directories grade churches on what works for one adult. Families need more than one adult's worth of fit — and the dimensions that matter shift with each kid added.",
    pains: [
      {
        title: "The kids' programme is hard to read from the website",
        body:
          "A thriving kids ministry and a smaller, just-getting-started one can look similar on a church website — both describe themselves warmly. Finding out which is which on the day, with two kids in the car, isn't ideal. A directory listing that shows a few specifics up front saves a Sunday.",
      },
      {
        title: "You want teaching that fits your family's posture",
        body:
          "Every parent has a sense of the texture they want — how questions are handled, how Scripture is taught, how the room handles complexity. Church websites don't always make that texture easy to read. The directory's filters and profile copy help you spot the fit without committing a Sunday to find out.",
      },
      {
        title: "Music for kids vs music for the rest of the room",
        body:
          "A toddler-friendly Sunday matters at home. A worship service that feels like a 20-minute Wiggles set doesn't always work for adults. The best family churches manage both — kids feel seen and the adult service still has musical substance. That balance is hard to spot from a directory listing.",
      },
      {
        title: "Saturday-night logistics already eat your week",
        body:
          "Two kids' bedtimes, packing the Sunday bag, finding shoes. The last thing you need is a church-search that takes ten clicks and produces a list of congregations 40 minutes away. The directory needs to give you a usable short list before bedtime so you can actually go in the morning.",
      },
    ],

    solution_h2: "How GospelChannel helps families pick a Sunday",
    solution_lede:
      "Four ways the directory makes the family-fit decision faster — without pretending the dimensions of family fit are simple.",
    solutions: [
      {
        title: "Browse by city to keep the drive realistic",
        body:
          "Open your city's page and you'll see every church listed there. With kids in the car, walkable or short-drive matters; the city filter saves you wading through suburbs an hour out.",
        href: "/church/city",
        cta: "Browse cities",
      },
      {
        title: "Filter by denomination for the broad shape",
        body:
          "Baptist, Pentecostal, non-denominational, Vineyard, and Anglican congregations all tend to have well-developed family programmes — each with a different texture. Filter to a tradition that fits your background or your kids' grandparents'.",
        href: "/church/denomination",
        cta: "Browse denominations",
      },
      {
        title: "Read what a first visit feels like",
        body:
          "Many church profiles include a \"what to expect\" section written for first-time visitors — kids ministry, dress code, length of service. Useful pre-context when you're prepping kids for somewhere new on Sunday morning.",
        href: "/guides/first-visit-guide",
        cta: "Read the guide",
      },
      {
        title: "Take the fit quiz with your partner",
        body:
          "Seven questions, three matches. Designed for one user, but most families run it once each and triangulate from the overlap. Useful for surfacing the two or three congregations worth visiting before kicking off a longer search.",
        href: "/guides/church-fit-quiz",
        cta: "Take the quiz",
      },
    ],

    curated_h2: "Strong family-and-church traditions to start with",
    curated_lede:
      "Six denomination pages where family-focused congregations are common. Each lists every church in that tradition — narrow by city or country from there.",
    curated_cards: [
      {
        title: "Baptist churches",
        description:
          "Strong family programmes are a longstanding Baptist hallmark — kids ministry, age-graded Sunday school, family events through the week.",
        href: "/church/denomination/baptist",
      },
      {
        title: "Non-denominational churches",
        description:
          "Free-church congregations often build the family programme from scratch, which means it usually reflects the church's actual priorities rather than a denominational template.",
        href: "/church/denomination/non-denominational",
      },
      {
        title: "Pentecostal churches",
        description:
          "Pentecostal congregations tend to be intergenerational by default — children visible in the main service, alongside dedicated kids work.",
        href: "/church/denomination/pentecostal",
      },
      {
        title: "Charismatic churches",
        description:
          "Charismatic networks (including Vineyard) tend to be warm, unstuffy, and family-aware — children welcome in the room and a kids programme that's solid without being slick.",
        href: "/church/denomination/charismatic",
      },
      {
        title: "Anglican churches",
        description:
          "Anglican parishes vary widely but family programmes are well-developed in most. Listed here for families coming from or curious about the tradition.",
        href: "/church/denomination/anglican",
      },
      {
        title: "Contemporary worship",
        description:
          "Many family-friendly free-churches lean contemporary. Skim this style to find congregations where the music works for both adults and kids.",
        href: "/church/style/contemporary-worship",
      },
    ],

    related_guides: [
      { href: "/guides/first-visit-guide", label: "First visit guide" },
      { href: "/guides/church-fit-quiz", label: "Church fit quiz" },
      { href: "/guides/faith-faq", label: "Faith FAQ" },
    ],

    faq_h2: "Family church-finding FAQ",
    faqs: [
      {
        question: "How do I read a church's kids ministry before visiting?",
        answer:
          "Look for specifics in the church's profile copy and on its own website — age groups, room locations, what happens during the main service, sign-in procedures. Specifics usually signal a well-resourced ministry; warmer general language is common at smaller or newer congregations that are still growing the programme. Either can be the right fit — visiting once is the most honest way to know.",
      },
      {
        question: "What denominations are most family-friendly?",
        answer:
          "Family-friendliness depends more on the specific congregation than the denomination. That said, Baptist, Pentecostal, non-denominational, Vineyard, and many evangelical Anglican congregations have strong family infrastructure as a default. Use denomination to narrow, then visit to confirm.",
      },
      {
        question: "Does GospelChannel cover state churches like Svenska Kyrkan or Church of England?",
        answer:
          "Some of those congregations are listed but our positioning is the free-church / evangelical / charismatic segment. For purely state-church or liturgical-tradition family churches, a denomination-specific directory will fit better.",
      },
      {
        question: "Is GospelChannel free?",
        answer:
          "Yes. Free for visitors to browse, free for churches to claim and edit profiles. No paid tiers today.",
      },
      {
        question: "Can my kids' grandparents' church get listed?",
        answer:
          "If it's in the free-church spectrum, yes. Submit it via /church/suggest and we'll review and publish. If it's been claimed by the pastor or a leader, they can edit details directly.",
      },
    ],

    cta_h2: "Pick a Sunday the whole household can live with",
    cta_lede:
      "Browse by city, narrow by denomination or worship style, and have a short list ready before Saturday's bedtime routine.",
  },

  "new-believers": {
    slug: "new-believers",
    audience_name: "New believers",

    meta_title: "Welcoming Churches for New Christians — GospelChannel",
    meta_description:
      "Recently came to faith? Find a welcoming free-church or evangelical congregation. Plain-spoken, no jargon, no assumption you already know the rules.",

    hero_eyebrow: "For new believers",
    hero_h1: "Find a welcoming church for new Christians",
    hero_lede:
      "You've recently come to faith and you've never been to a church on a regular basis. Most churches will be welcoming if you walk in. The trick is picking a first one that doesn't assume you already know the words. GospelChannel helps you find a free-church or evangelical congregation that takes new believers seriously — without making it weird.",

    pain_h2: "The first-time-Christian Sunday problem",
    pain_lede:
      "Most church directories assume you grew up in church. New believers hit a set of problems other audiences don't — and most of them are quiet, not loud.",
    pains: [
      {
        title: "You don't know the unspoken rules",
        body:
          "When to stand, when to sit, when to say amen, whether you walk forward for communion. Established congregations forget that none of this is obvious. Walking in for the first time, every transition feels like a quiz you didn't study for, and the longer the service goes the more you're aware of it.",
      },
      {
        title: "The terminology lands sideways",
        body:
          "Words like sanctification, atonement, doctrine, communion, intercession show up in normal sentences. You can usually piece together what they mean, but it costs concentration you'd rather spend on the actual sermon. A church that explains its own vocabulary from time to time is doing new believers a quiet favour.",
      },
      {
        title: "You don't always know which questions are routine",
        body:
          "Churches handle big questions — hell, judgement, Scripture, ethics — in different ways. Some open them up freely; others prefer to handle them in dedicated discipleship classes. Neither is wrong; both can be excellent. But as a new believer it helps to land somewhere that fits how you process — and a directory with detailed profile copy makes that easier to read in advance.",
      },
      {
        title: "Friend who invited you may not be there next week",
        body:
          "A lot of new believers come through one person — a friend, partner, colleague, family member. When that person can't make next Sunday, you're suddenly on your own in a building where everyone seems to know each other. The first congregation needs to be one you can keep showing up to when your one connection is travelling.",
      },
    ],

    solution_h2: "How GospelChannel helps a first Sunday actually be a first Sunday",
    solution_lede:
      "Four practical entry points designed for someone with no prior church experience.",
    solutions: [
      {
        title: "Read the first-visit guide first",
        body:
          "Before you pick a church, read what actually happens on a Sunday morning — the parking lot, the greeting, the music, the offering, the prayer, the dismissal. Nothing should surprise you the first time you walk in. It's the most-read piece on the site for a reason.",
        href: "/guides/first-visit-guide",
        cta: "Read the guide",
      },
      {
        title: "Read the faith FAQ second",
        body:
          "Common questions about salvation, the Bible, baptism, prayer, and the Holy Spirit — answered plainly without assuming you already share the answer. Use it to fill in vocabulary gaps before your first Sunday, or as a reference afterwards.",
        href: "/guides/faith-faq",
        cta: "Read the FAQ",
      },
      {
        title: "Take the fit quiz",
        body:
          "Seven questions, three matches. Designed to surface a small set of churches you can actually try this month rather than a long list to wade through. Honest answers produce better matches — there's no signup or scoring you up against anyone.",
        href: "/guides/church-fit-quiz",
        cta: "Take the quiz",
      },
      {
        title: "Browse free-church denominations",
        body:
          "Non-denominational, Baptist, Vineyard, Pentecostal — traditions that often have well-developed welcome flows for new believers. Pick the one that matches the friend or context that brought you to faith, or use the quiz if you don't know.",
        href: "/church/denomination",
        cta: "Browse denominations",
      },
    ],

    curated_h2: "Good first-Sunday starting points",
    curated_lede:
      "A short list of pages designed to take a new believer from \"I don't know where to start\" to \"I have a Sunday booked\" in fifteen minutes.",
    curated_cards: [
      {
        title: "First visit guide",
        description:
          "Step-by-step walk-through of what actually happens on a Sunday morning at a typical free-church congregation. Read this first.",
        href: "/guides/first-visit-guide",
      },
      {
        title: "Faith FAQ",
        description:
          "Common questions about salvation, the Bible, baptism, the Holy Spirit, and church life — answered plainly without assuming prior background.",
        href: "/guides/faith-faq",
      },
      {
        title: "Church fit quiz",
        description:
          "Seven-question quiz that surfaces three churches worth trying, calibrated to your worship style and context. No signup.",
        href: "/guides/church-fit-quiz",
      },
      {
        title: "Non-denominational churches",
        description:
          "Free-church congregations without a formal denominational affiliation. Often have clear welcome flows for newcomers and contemporary worship.",
        href: "/church/denomination/non-denominational",
      },
      {
        title: "Baptist churches",
        description:
          "Strong tradition of welcoming new believers, with well-developed baptism and discipleship pathways across most congregations.",
        href: "/church/denomination/baptist",
      },
      {
        title: "Charismatic churches",
        description:
          "Warm, low-jargon, often Spirit-led — the wider charismatic family (including Vineyard) tends to be unusually welcoming to people new to faith.",
        href: "/church/denomination/charismatic",
      },
    ],

    related_guides: [
      { href: "/guides/first-visit-guide", label: "First visit guide" },
      { href: "/guides/faith-faq", label: "Faith FAQ" },
      { href: "/guides/prayer-guide", label: "How to start praying" },
    ],

    faq_h2: "New-believer church-finding FAQ",
    faqs: [
      {
        question: "Do I need to know anything before I walk into a church for the first time?",
        answer:
          "No. Genuinely, no. Read the first-visit guide if you want to know what to expect, but you don't need a vocabulary or a doctrinal position. Showing up curious is enough. Free-church congregations in particular tend to be used to first-time visitors and built to welcome them.",
      },
      {
        question: "What's the difference between the denominations?",
        answer:
          "Each tradition has its own emphasis — Baptist on baptism by immersion and congregational governance, Pentecostal on the Holy Spirit, non-denominational on local autonomy, Vineyard on warm charismatic worship, and so on. The faith FAQ explains the most common ones in plain terms. For your first Sunday, the difference between traditions matters less than the difference between specific congregations.",
      },
      {
        question: "Is GospelChannel free?",
        answer:
          "Yes. Free to browse, the quiz is free, the guides are free, no signup required.",
      },
      {
        question: "I'm not sure I'm \"in\" yet — should I still go to a church?",
        answer:
          "Yes, if you want to. Many people walk into a free-church congregation with an honest \"I'm exploring\" posture and find it welcomed rather than treated as a problem to fix. You don't have to be sure of anything before you arrive — most pastors would rather meet you while you're working it out than miss you because you waited.",
      },
      {
        question: "What if the first church I try isn't the right one?",
        answer:
          "Try another. The first congregation isn't a permanent commitment; it's just a first Sunday. Most people land at the third or fourth church they visit, not the first. If you're in a small town with limited options, the fit quiz and worship-style filter help maximise the chance of a fit on the first try.",
      },
    ],

    cta_h2: "Take the first Sunday at your own pace",
    cta_lede:
      "Read the first-visit guide, take the fit quiz, and pick one church to try this Sunday. No more than one — keep it small.",
  },

  deconstructing: {
    slug: "deconstructing",
    audience_name: "Deconstructing seekers",

    meta_title: "Church for Post-Evangelical Seekers — GospelChannel",
    meta_description:
      "Looking for a free-church or evangelical congregation while processing your church history? A broader, non-graded directory that lets you set the filter.",

    hero_eyebrow: "For deconstructing seekers",
    hero_h1: "A church for people processing their church history",
    hero_lede:
      "You grew up in church. Something cracked. Maybe a lot of things. You're not sure you can go back to where you came from, and you're not sure you want to leave entirely. GospelChannel doesn't grade churches on anyone's confessional rubric and doesn't pretend there's one right Sunday for everyone — which makes it usable when you're processing what happened.",

    pain_h2: "The deconstructing-Sunday problem nobody warns you about",
    pain_lede:
      "Most church directories implicitly serve people who never left. Their filters, their language, their assumed audience. Deconstructing seekers hit a different set of problems — quieter than active deconversion, harder to explain than just \"shopping for a new church.\"",
    pains: [
      {
        title: "Familiar phrases fire faster than discernment",
        body:
          "You walk in. The pastor uses a phrase your home pastor used. Your shoulders go up. Half an hour in you're tracking everything against an old grid — and the comparison is doing all the work the worship was supposed to. That isn't fair to the congregation in front of you; it's also not something you can fully switch off in week one.",
      },
      {
        title: "You're tired of being scored",
        body:
          "Some directories grade churches on a confessional rubric and rank accordingly. After a hard season, that scoring itself can be part of what's tiring. A list that doesn't try to settle the question for you — that just shows what's there and lets you decide — is more usable when you're still working things out.",
      },
      {
        title: "You want community without low-grade tension every Sunday",
        body:
          "You still want Sunday singing, the lifelong-friend vibe, communion, prayer. You don't necessarily want every sermon to land on the same set of contemporary debates. The line between formative theology and topical emphasis is real and it's hard to spot from a website — you need a way to read the room before you walk in.",
      },
      {
        title: "Going alone feels safer than going wrong",
        body:
          "After a season of hard fit, going alone feels manageable. Going with friends or family doubles the stakes — you don't want to lead someone else into a Sunday that lands wrong or that you have to explain afterwards. Months pass. The not-going hardens into a pattern that wasn't actually what you wanted.",
      },
    ],

    solution_h2: "How GospelChannel works for someone still working it out",
    solution_lede:
      "Four ways the directory is shaped to be usable when you're processing rather than shopping.",
    solutions: [
      {
        title: "No theological grading on our side",
        body:
          "We list churches across the free-church spectrum without confessional gates. You decide what's a deal-breaker. No score, no ranking, no implicit \"approved.\" That makes the directory broader than some, which is exactly the point when you're calibrating from scratch.",
        href: "/church",
        cta: "Open the directory",
      },
      {
        title: "Filter by tradition you already trust",
        body:
          "If the wider Vineyard or Baptist or Anglican feel of things sits well with you right now and another tradition feels tender, that's an honest filter. Use what works for this season; revisit later when other things stop being raw. The directory doesn't judge the filter choice.",
        href: "/church/denomination",
        cta: "Browse denominations",
      },
      {
        title: "Hear the music first",
        body:
          "For many in this season, the worship is the easiest entry point — it lets you sit with the room before words land. Profiles with Spotify or YouTube give you a preview. If a track lands well at your kitchen table, the Sunday is worth trying. If it doesn't, you've saved both your time and the congregation's.",
        href: "/church",
        cta: "Browse the directory",
      },
      {
        title: "Pray on the prayer wall, even before you visit anywhere",
        body:
          "The prayer wall is anonymous, public-or-private, and doesn't require a church. Some seekers reconnect through prayer before reconnecting through any specific congregation. It's there if you want it.",
        href: "/prayerwall",
        cta: "Open the prayer wall",
      },
    ],

    curated_h2: "Lower-friction starting points",
    curated_lede:
      "Six pages chosen because they tend to host congregations that handle questions, doubt, and church history with less reactivity. Each links to every church in that bucket.",
    curated_cards: [
      {
        title: "Anglican churches",
        description:
          "Anglican congregations vary widely; the tradition itself has long sat comfortably with hard questions and intellectual breadth. A common landing point for evangelicals in this season.",
        href: "/church/denomination/anglican",
      },
      {
        title: "Charismatic churches",
        description:
          "Warm, low-jargon, Spirit-led — covers Vineyard and other charismatic networks that tend to make space for doubt and questions as part of normal church life.",
        href: "/church/denomination/charismatic",
      },
      {
        title: "Non-denominational churches",
        description:
          "Each non-denominational congregation is its own thing. That variety means it's worth reading individual profiles — but it also means you're not signing on to a specific denominational identity you may not be ready for.",
        href: "/church/denomination/non-denominational",
      },
      {
        title: "Prayer wall",
        description:
          "Anonymous space to pray and be prayed for, with or without a church attached. Sometimes the right next step.",
        href: "/prayerwall",
      },
      {
        title: "Faith FAQ",
        description:
          "Plain-spoken answers to common questions about salvation, baptism, the Holy Spirit, and church — without the loaded framing.",
        href: "/guides/faith-faq",
      },
      {
        title: "How to start praying",
        description:
          "If prayer itself has gotten complicated, this guide is the shortest path back into it. No jargon. No pressure.",
        href: "/guides/prayer-guide",
      },
    ],

    related_guides: [
      { href: "/guides/faith-faq", label: "Faith FAQ" },
      { href: "/guides/prayer-guide", label: "How to start praying" },
      { href: "/guides/first-visit-guide", label: "First visit guide" },
    ],

    faq_h2: "Deconstructing-seeker FAQ",
    faqs: [
      {
        question: "Is GospelChannel a deconstruction-friendly directory?",
        answer:
          "We're broad rather than aligned. We don't grade churches against a confessional rubric, we don't assume everyone has the same theology, and we cover the wider free-church spectrum from charismatic to Reformed Baptist. That makes the directory usable when you're processing church history, even though we're not specifically a deconstruction project.",
      },
      {
        question: "How do I avoid landing somewhere that feels like the place I came from?",
        answer:
          "The denomination filter, the worship-style filter, and the church's own profile copy are the main tools. If a specific tradition feels tender right now, browse a different tradition first — Anglican, Vineyard, and broader non-denominational congregations are common starting points for people who want a softer entry. Visiting once and not returning is a fine response if a specific Sunday doesn't fit; that's not a judgement on the church, just a fit signal for you.",
      },
      {
        question: "Do I have to be sure of what I believe to use the directory?",
        answer:
          "No. The directory doesn't ask. It lists churches and lets you decide. Many people use it during a deconstructing season specifically because there isn't an account, a profile, or a position-paper you have to fill in to use it.",
      },
      {
        question: "Is the prayer wall a substitute for going to a church?",
        answer:
          "It can be a bridge rather than a substitute. Some seekers use it to keep a thread of prayer alive while they're not attending anywhere. Others use it alongside a church they're starting to try again. It's not a replacement and we don't pitch it as one; it's a separate, lower-friction surface.",
      },
      {
        question: "What if I don't want to go back to church at all right now?",
        answer:
          "That's a legitimate place to be and the directory doesn't push you out of it. Many deconstructing seekers spend months on the prayer wall, the faith FAQ, and the guides without ever visiting a congregation. There's no clock. We're not trying to convert your season into someone else's.",
      },
    ],

    cta_h2: "Take the next step at your own pace",
    cta_lede:
      "Use the directory, the prayer wall, or the guides at whatever depth you want. None of them require an account or push you somewhere you're not ready to be.",
  },
};
