// Demo data for Hillsong Church (Sydney) — used across all three variants.
// Includes both a full-data view and a "lite" view to demonstrate empty-state grace.

window.HILLSONG = {
  name: "Hillsong Church",
  officialName: "Hillsong Church Sydney",
  tagline: "A welcoming family on a mission to reach and influence the world.",
  founded: 1983,
  country: "Australia",
  city: "Sydney",
  streetAddress: "1–9 Solent Circuit, Norwest, NSW 2153",
  denomination: "Pentecostal",
  size: "Megachurch",
  languages: ["English"],
  pastor: {
    name: "Phil & Lucinda Dooley",
    title: "Global Senior Pastors",
    photo: "https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=240&h=240&fit=crop&crop=faces",
    quote:
      "When you walk through our doors, we want you to feel seen, known and welcomed — exactly as you are. There's a seat saved for you on Sunday.",
  },
  hero: {
    primary:
      "https://images.unsplash.com/photo-1519834785169-98be25ec3f84?w=2400&q=85&auto=format&fit=crop",
    secondary:
      "https://images.unsplash.com/photo-1438232992991-995b7058bbb3?w=1600&q=85&auto=format&fit=crop",
    interior:
      "https://images.unsplash.com/photo-1507692049790-de58290a4334?w=1600&q=85&auto=format&fit=crop",
    crowd:
      "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=1600&q=85&auto=format&fit=crop",
  },
  logo: "https://images.unsplash.com/photo-1438232992991-995b7058bbb3?w=200&h=200&fit=crop",
  description:
    "A contemporary Pentecostal church known worldwide for its worship music. Hillsong gathers thousands across Sydney each weekend, with services that move from heartfelt worship into practical, hope-filled teaching. Whether you're exploring faith for the first time or you've been walking with God for decades, there's space for you here.",
  whatToExpect:
    "Modern worship band, ~80 minute service, casual dress, free coffee in the foyer, kids program runs in parallel. First-time visitors get a small welcome gift at the connect desk.",
  serviceDuration: 80,
  serviceTimes: [
    { day: "Sunday", time: "9:00 AM" },
    { day: "Sunday", time: "11:00 AM" },
    { day: "Sunday", time: "6:00 PM" },
  ],
  parking: "Free on-site parking. Wheelchair accessible. Sign language interpretation at the 11 AM service.",
  contact: {
    email: "info@hillsong.com",
    phone: "+61 2 8853 5353",
    website: "hillsong.com",
  },
  styles: ["Contemporary", "Worship", "Anthemic", "Pop-rock"],
  notableArtists: ["Brooke Ligertwood", "Hillsong UNITED", "Hillsong Young & Free", "Taya"],
  social: {
    youtube: { url: "https://youtube.com/hillsong", count: 11_300_000 },
    instagram: { url: "https://instagram.com/hillsong", count: 4_800_000 },
    facebook: { url: "https://facebook.com/hillsong", count: 6_200_000 },
    spotify: "https://open.spotify.com/artist/4FxL6FIxQpTAEzEMnXjQbm",
  },
  ministries: ["Children", "Youth", "Young Adults", "Worship", "Small Groups", "Global Missions"],
  goodFitTags: [
    "First-time visitors",
    "Young families",
    "Students & young adults",
    "Music lovers",
    "Modern worship",
    "Big-room worship",
  ],
  topSongs: [
    { title: "What A Beautiful Name", artist: "Hillsong Worship", duration: "4:21", plays: "1.2B" },
    { title: "Oceans (Where Feet May Fail)", artist: "Hillsong UNITED", duration: "8:54", plays: "890M" },
    { title: "King of Kings", artist: "Hillsong Worship", duration: "4:42", plays: "210M" },
    { title: "Who You Say I Am", artist: "Hillsong Worship", duration: "5:13", plays: "180M" },
    { title: "So Will I (100 Billion X)", artist: "Hillsong UNITED", duration: "7:25", plays: "165M" },
    { title: "Cornerstone", artist: "Hillsong Worship", duration: "4:30", plays: "140M" },
  ],
  faq: [
    {
      q: "What should I wear?",
      a: "Whatever you're comfortable in. You'll see everything from suits to t-shirts and jeans. The dress code is genuinely come-as-you-are.",
    },
    {
      q: "How long is the service?",
      a: "About 80 minutes — roughly 30 minutes of worship music, 35 minutes of teaching, and 15 minutes of response and announcements.",
    },
    {
      q: "Is there something for my kids?",
      a: "Yes. Hillsong Kids runs in parallel with every service for ages 0–12, with separate age-appropriate programs and trained leaders.",
    },
    {
      q: "What if I've never been to church before?",
      a: "You're especially welcome. Stop by the Connect Desk in the foyer — we've got a small welcome gift and people who'd love to answer your questions, no pressure to commit to anything.",
    },
    {
      q: "Where do I park?",
      a: "Free parking is available on-site. Volunteers will direct you on arrival. Accessible spaces are reserved closest to the main entrance.",
    },
  ],
  testimonials: [
    {
      quote: "I came in skeptical and left with people I now call family. The worship was unreal.",
      name: "Sarah M.",
      detail: "First visit, March 2025",
    },
    {
      quote: "Found my people here. The community groups during the week are where it really clicked for me.",
      name: "Daniel K.",
      detail: "Member, 3 years",
    },
  ],
};

// "Lite" version — sparse data, used to show empty-state grace.
window.SMALL_CHURCH = {
  name: "Filadelfiakyrkan Linköping",
  country: "Sweden",
  city: "Linköping",
  streetAddress: "Lasarettsgatan 8, 582 25 Linköping",
  denomination: "Pentecostal",
  founded: 1921,
  description:
    "En liten varm församling mitt i Linköping. Vi tror på en levande Gud, äkta gemenskap och att alla människor förtjänar att höra om Jesus.",
  serviceTimes: [{ day: "Söndag", time: "11:00" }],
  contact: { website: "filadelfialinkoping.se" },
  styles: ["Lovsång"],
  goodFitTags: ["Familjer", "Nya i tron"],
  // Intentionally missing: pastor, social, music, FAQ, testimonials, hero image.
  hero: { primary: "" },
};
