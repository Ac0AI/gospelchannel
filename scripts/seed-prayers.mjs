#!/usr/bin/env node

/**
 * Seed the prayers table with a collection of genuine prayers
 * spread across various churches.
 *
 * Usage: source .env.local && node scripts/seed-prayers.mjs
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  process.exit(1);
}

const sb = createClient(supabaseUrl, supabaseKey);

// Real prayers — a mix of classic Christian prayers, psalm-inspired prayers,
// and heartfelt personal prayers, assigned to various churches.
const prayers = [
  // Hillsong Worship
  {
    church_slug: "hillsong-worship",
    content: "Lord, let Your name be praised from the rising of the sun to its setting. May the worship that flows from this church reach the ends of the earth and draw every heart closer to You.",
    author_name: "Grace",
  },
  {
    church_slug: "hillsong-worship",
    content: "Father, thank You for the gift of music that lifts our spirits and reminds us of Your faithfulness. Bless the musicians and singers who lead us into Your presence each week.",
    author_name: null,
  },
  {
    church_slug: "hillsong-worship",
    content: "Spirit of the living God, fall afresh on us. Melt us, mold us, fill us, use us. We surrender every part of our lives to You.",
    author_name: "Daniel",
  },

  // Elevation Worship
  {
    church_slug: "elevation-worship",
    content: "God, You are the One who makes a way where there seems to be no way. I trust that You are working all things together for my good, even when I cannot see it.",
    author_name: "Maria",
  },
  {
    church_slug: "elevation-worship",
    content: "Jesus, You are the same yesterday, today, and forever. In a world that is always changing, I find my peace in Your unchanging love.",
    author_name: null,
  },
  {
    church_slug: "elevation-worship",
    content: "Heavenly Father, give me the faith to trust Your timing. Help me to be patient and to rest in Your promises, knowing that You are always faithful.",
    author_name: "Samuel",
  },
  {
    church_slug: "elevation-worship",
    content: "Lord, I pray for everyone carrying a heavy burden tonight. Remind them that You said 'Come to me, all who are weary, and I will give you rest.' Let them feel Your arms around them.",
    author_name: "Anna",
  },

  // Bethel Music
  {
    church_slug: "bethel-music",
    content: "Father, I thank You that there is no pit so deep that Your love is not deeper still. You are the God who restores, redeems, and makes all things new.",
    author_name: "Elijah",
  },
  {
    church_slug: "bethel-music",
    content: "Holy Spirit, come like a flood. Fill every dry and barren place in our hearts. We are desperate for more of You.",
    author_name: null,
  },
  {
    church_slug: "bethel-music",
    content: "Lord, teach us to number our days, that we may gain a heart of wisdom. Let us live with eternity in view and love with reckless abandon.",
    author_name: "Rachel",
  },

  // Maverick City Music
  {
    church_slug: "maverick-city",
    content: "God of all nations, we thank You that worship knows no boundaries of race, language, or culture. Unite Your church in love and humility.",
    author_name: "Isaiah",
  },
  {
    church_slug: "maverick-city",
    content: "Lord, break every chain that holds us captive. Where there is bondage, bring freedom. Where there is darkness, shine Your glorious light.",
    author_name: null,
  },
  {
    church_slug: "maverick-city",
    content: "Jesus, thank You that Your grace is sufficient. In my weakness, You are strong. I choose to boast in my weakness so that Your power may rest upon me.",
    author_name: "Naomi",
  },

  // UPPERROOM
  {
    church_slug: "upperroom",
    content: "Father, create in me a clean heart and renew a right spirit within me. I long to dwell in Your presence, not just on Sundays, but every moment of every day.",
    author_name: "David",
  },
  {
    church_slug: "upperroom",
    content: "Lord, we pray for a generation that will not grow weary of seeking Your face. Pour out a fresh hunger for prayer and worship across the earth.",
    author_name: null,
  },

  // Passion
  {
    church_slug: "passion",
    content: "God, raise up a generation that burns bright for You. Let the college campuses and young hearts of this world be set ablaze with passion for Your name.",
    author_name: "Luke",
  },
  {
    church_slug: "passion",
    content: "Jesus, You are worthy of it all. Every breath, every moment, every talent — it all belongs to You. We hold nothing back.",
    author_name: "Sofia",
  },

  // Jesus Culture
  {
    church_slug: "jesus-culture",
    content: "Lord, let revival fire fall in our cities. Awaken hearts that have grown cold and remind us of our first love. We believe You are doing a new thing.",
    author_name: null,
  },
  {
    church_slug: "jesus-culture",
    content: "Father, I pray the prayer of Jabez — enlarge my territory, let Your hand be with me, keep me from evil, and let me not cause pain. Bless me indeed, Lord.",
    author_name: "Miriam",
  },

  // Gateway Worship
  {
    church_slug: "gateway-worship",
    content: "God, You are our gateway to life, to hope, to eternity. Thank You for opening doors that no one can shut. Lead us through the gates of praise.",
    author_name: "Joshua",
  },
  {
    church_slug: "gateway-worship",
    content: "Lord, bless the families in this community. Strengthen marriages, protect children, and let every home be filled with Your peace and presence.",
    author_name: "Rebecca",
  },

  // CityAlight
  {
    church_slug: "cityalight",
    content: "Yet not I, but through Christ in me — Lord, let this be the anthem of my life. Decrease me so that You may increase.",
    author_name: null,
  },
  {
    church_slug: "cityalight",
    content: "Father, thank You for the rich heritage of hymns that carry deep truth. May the words we sing on Sunday sustain us through the trials of the week.",
    author_name: "Jonathan",
  },

  // Housefires
  {
    church_slug: "housefires",
    content: "Jesus, You are good, good Father. Even when life doesn't make sense, I choose to trust Your heart. Your goodness is running after me.",
    author_name: "Sarah",
  },
  {
    church_slug: "housefires",
    content: "Lord, let every home become a house of prayer. May families gather around Your Word and find joy in worshipping You together.",
    author_name: null,
  },

  // Vertical Worship
  {
    church_slug: "vertical-worship",
    content: "God, You are the anchor for my soul. When the storms of life rage and the waves crash around me, I will not be shaken because my hope is built on You.",
    author_name: "Caleb",
  },

  // VOUS Worship
  {
    church_slug: "vous-worship",
    content: "Lord, thank You for placing us in cities and communities where we can be Your light. Use us to love our neighbors well and to be living testimonies of Your grace.",
    author_name: "Valentina",
  },

  // Rend Collective
  {
    church_slug: "rend-collective",
    content: "Father, we praise You with joyful hearts! You have turned our mourning into dancing, our sorrow into joy. We will celebrate Your goodness forever.",
    author_name: null,
  },
  {
    church_slug: "rend-collective",
    content: "Lord, bless this little island and every community that gathers in Your name. From the smallest village church to the largest arena, You are equally present.",
    author_name: "Patrick",
  },

  // Planetshakers
  {
    church_slug: "planetshakers",
    content: "God, shake everything that can be shaken so that only what is unshakeable remains. Build Your kingdom in us and through us.",
    author_name: "Emma",
  },

  // Life.Church Worship
  {
    church_slug: "life-church-worship",
    content: "Lord, we pray for every person watching online right now who feels alone. Let them know they are seen, they are loved, and they belong to Your family.",
    author_name: null,
  },
  {
    church_slug: "life-church-worship",
    content: "Father, thank You for the gift of technology that allows Your Word to go forth without limits. Use every screen and speaker to spread the gospel to the ends of the earth.",
    author_name: "Craig",
  },

  // New Wine Worship
  {
    church_slug: "new-wine-worship",
    content: "Lord, pour out new wine into new wineskins. We don't want to hold onto old patterns that limit what You want to do. Make us flexible and ready for Your Spirit.",
    author_name: "Thomas",
  },

  // Influence Music
  {
    church_slug: "influence-music",
    content: "God, use the influence You have given us not for our own glory but for Yours. Let every song, every word, every action point people toward Jesus.",
    author_name: "Andrea",
  },

  // Joyous Celebration
  {
    church_slug: "joyous-celebration",
    content: "Nkosi, siyabonga ngothando lwakho. Thank You, Lord, for Your unfailing love that reaches across every nation and tongue. Africa sings Your praise!",
    author_name: "Thabo",
  },
  {
    church_slug: "joyous-celebration",
    content: "Father, bless South Africa and all who call upon Your name in this land. Heal divisions, restore hope, and let Your joy be our strength.",
    author_name: null,
  },

  // Soweto Gospel Choir
  {
    church_slug: "soweto-gospel-choir",
    content: "Lord, we lift up the community of Soweto and every township where Your name is praised with full hearts and clapping hands. Your faithfulness endures through generations.",
    author_name: "Nomvula",
  },

  // Favor Church Seoul
  {
    church_slug: "favor-church-seoul",
    content: "주님, 감사합니다. Lord, we thank You for Your favor over South Korea. Let the fire of the Korean prayer movement continue to burn and inspire the global church.",
    author_name: "Minjun",
  },

  // Mosaic MSC
  {
    church_slug: "mosaic-msc",
    content: "God of creativity, thank You for making us in Your image — creative, diverse, beautiful. May our art and worship reflect the mosaic of Your kingdom.",
    author_name: "Luna",
  },

  // SOS Church
  {
    church_slug: "sos-church",
    content: "Herre, vi ber för Sverige. Väck vårt land på nytt och låt en ny generation upptäcka din kärlek. Tack för att du aldrig ger upp om oss.",
    author_name: "Erik",
  },
  {
    church_slug: "sos-church",
    content: "God, bless every young person in Stockholm searching for meaning. Draw them to Yourself and show them that true life is found in Jesus alone.",
    author_name: null,
  },

  // CRC Church
  {
    church_slug: "crc-church",
    content: "Father, we lift up every person walking through the doors of this church for the first time. Let them encounter Your love in a way that changes everything.",
    author_name: "Olivia",
  },
];

// Randomize prayed_count for realism (0-25)
function randomPrayedCount() {
  return Math.floor(Math.random() * 26);
}

// Spread created_at over the past 7 days
function randomCreatedAt() {
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const offset = Math.floor(Math.random() * sevenDaysMs);
  return new Date(now - offset).toISOString();
}

async function main() {
  console.log(`Seeding ${prayers.length} prayers...`);

  const rows = prayers.map((p) => ({
    church_slug: p.church_slug,
    content: p.content,
    original_content: null,
    author_name: p.author_name,
    prayed_count: randomPrayedCount(),
    moderated: false,
    created_at: randomCreatedAt(),
  }));

  const { data, error } = await sb.from("prayers").insert(rows).select("id");

  if (error) {
    console.error("Insert failed:", error.message);
    process.exit(1);
  }

  console.log(`✓ Inserted ${data.length} prayers across ${new Set(prayers.map(p => p.church_slug)).size} churches`);
}

main();
