#!/usr/bin/env node

/**
 * Seed 50 realistic, everyday prayers spread across churches worldwide.
 * Usage: source .env.local && node scripts/seed-prayers-batch2.mjs
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  process.exit(1);
}

const sb = createClient(supabaseUrl, supabaseKey);

const prayers = [
  // Everyday life
  { church_slug: "hillsong-worship", content: "My dog Max was diagnosed with cancer last week. He's only 6. I know it sounds small but he's my best friend. Please pray for him and for me to handle whatever comes.", author_name: "Jake" },
  { church_slug: "bethel-music", content: "Starting a new job on Monday and I'm terrified. Pray that I find my footing and that my new coworkers are kind.", author_name: "Lisa" },
  { church_slug: "elevation-worship", content: "My daughter is being bullied at school. She doesn't want to go anymore. God, protect her heart and give us wisdom.", author_name: "Marcus" },
  { church_slug: "c3-church-cape-town", content: "We haven't had rain in weeks and the crops are struggling. Lord, send rain to the Western Cape.", author_name: null },
  { church_slug: "maverick-city", content: "I relapsed again last night. I'm so tired of this cycle. Please pray that I find the strength to keep fighting.", author_name: null },
  { church_slug: "passion", content: "Just found out I'm pregnant. We weren't planning this but I choose to trust God's timing. Pray for a healthy baby.", author_name: "Hannah" },

  // Family
  { church_slug: "gateway-worship", content: "My parents are getting divorced after 32 years. I don't even know how to process it. Pray for all of us.", author_name: "Tyler" },
  { church_slug: "aspnaskyrkan", content: "Min mamma fick stroke i förra veckan. Hon kan inte prata ännu. Herre, ge henne styrka att komma tillbaka.", author_name: "Linnea" },
  { church_slug: "bayside-church", content: "My teenage son won't talk to me anymore. I miss who we used to be. Pray that God opens a door between us again.", author_name: "Denise" },
  { church_slug: "rend-collective", content: "My wee gran turned 90 today. She's the one who brought me to church. Thank you God for her life and her prayers over me all these years.", author_name: "Ciara" },
  { church_slug: "calvary-chapel-helsinki", content: "Pray for my brother who moved to Finland alone. He doesn't know anyone and winter is hard. May he find community.", author_name: "Alex" },

  // Health
  { church_slug: "life-church-worship", content: "Got my scan results back and they need to do more tests. I'm trying not to spiral. Just pray for peace while I wait.", author_name: "Morgan" },
  { church_slug: "planetshakers", content: "My mate Dave is 28 and just had a heart attack. He has two little kids. God, please heal him completely.", author_name: "Ben" },
  { church_slug: "upperroom", content: "I've been dealing with depression for months. Some days I can barely get out of bed. I need prayer for the will to keep going.", author_name: null },
  { church_slug: "chiesa-breccia-di-roma", content: "Mia nonna sta lottando con l'Alzheimer. Non mi riconosce più. Signore, abbracciala dove io non posso arrivare.", author_name: "Marco" },
  { church_slug: "alive-church-montreal", content: "Pray for my friend who's going through chemo. She's only 34. She's the strongest person I know but she's exhausted.", author_name: "Sophie" },

  // Work and finances
  { church_slug: "vous-worship", content: "I got laid off today. I have rent due in two weeks and no savings. God, I need a miracle.", author_name: null },
  { church_slug: "mosaic-msc", content: "Running a small business is so lonely sometimes. Pray that I make wise decisions and don't lose hope when things are slow.", author_name: "Carlos" },
  { church_slug: "vertical-worship", content: "My husband works two jobs and we still can't make ends meet. We're not asking for much, just enough. Lord, provide.", author_name: "Tanya" },
  { church_slug: "gbi-mawar-sharon", content: "Saya baru lulus kuliah dan belum mendapat pekerjaan. Tuhan, tunjukkan jalan-Mu. I just graduated and have no job yet. Show me the way.", author_name: "Adi" },

  // Gratitude
  { church_slug: "joyous-celebration", content: "I got the scholarship! After years of praying and working night shifts. God is faithful. Thank you Jesus.", author_name: "Blessing" },
  { church_slug: "housefires", content: "My marriage was on the rocks a year ago. We started praying together every night and something shifted. Thank you Lord for saving us.", author_name: null },
  { church_slug: "cityalight", content: "I've been sober for one year today. Only God could have done this. I was so far gone and He pulled me back.", author_name: "James" },
  { church_slug: "belmont-church", content: "Thank you God for a boring, ordinary Tuesday. No crisis, no drama. Just coffee and sunshine. Sometimes normal is the greatest blessing.", author_name: "Pam" },

  // Community and world
  { church_slug: "all-nations-church-dublin", content: "Pray for the refugees arriving in Dublin. So many of them are alone and scared. May they find warmth and welcome here.", author_name: "Aoife" },
  { church_slug: "american-church-in-berlin-e-v", content: "Pray for peace in this world. It feels like everything is falling apart. Remind us that You are still on the throne.", author_name: null },
  { church_slug: "sos-church", content: "Herre, jag ber för alla som sover ute i Stockholm ikväll. Det är kallt. Låt oss vara dina händer och fötter.", author_name: "Josefin" },
  { church_slug: "christ-city-church-central", content: "Lord, there are so many lonely people in this city. Help us to see them. Help us to stop and actually care.", author_name: "Niamh" },
  { church_slug: "anchor-church-sydney", content: "Pray for the firefighters battling bushfires up north. They've been out there for days. Protect them and send rain.", author_name: "Matt" },

  // Faith struggles
  { church_slug: "jesus-culture", content: "I'm struggling to believe right now. Church feels empty. I'm going through the motions. God if you're there, show me something.", author_name: null },
  { church_slug: "new-wine-worship", content: "I feel so far from God. I haven't prayed properly in months. I don't even know what to say anymore. Just... help.", author_name: "Tom" },
  { church_slug: "wearechurch", content: "I left the church years ago after being hurt. I'm trying to come back but the trust is hard to rebuild. Pray for my heart.", author_name: null },
  { church_slug: "favor-church-seoul", content: "Sometimes I wonder if my prayers even reach heaven. But I keep praying because I have nowhere else to go. Lord, I believe. Help my unbelief.", author_name: "Jiyeon" },

  // Students and young people
  { church_slug: "c3-church-manila", content: "Exams next week and I'm not ready. I know God doesn't care about my grades the way I do but please let me pass. I've worked so hard.", author_name: "Miguel" },
  { church_slug: "calvary-cork", content: "Moving away from home for the first time. I'm excited but also terrified. Pray I find good friends and a good church.", author_name: "Oisin" },
  { church_slug: "influence-music", content: "Pray for the kids in youth group. They're dealing with so much pressure from social media. They need to know their worth comes from God, not likes.", author_name: "Pastor K" },

  // Relationships
  { church_slug: "abundant-life-gospel-church", content: "I've been single for so long and I'm starting to lose hope. God, if marriage is in your plan for me, let me be patient. If not, give me peace.", author_name: null },
  { church_slug: "backadalskyrkan", content: "Min bästa vän och jag har inte pratat på tre månader efter ett bråk. Jag saknar henne. Ge mig modet att ringa.", author_name: "Emma" },
  { church_slug: "antwerp-international-protestant-church-vzw", content: "Pray for my marriage. We love each other but we've forgotten how to talk. We need help and we're too proud to ask.", author_name: null },

  // Misc real life
  { church_slug: "bergen-anglican-church", content: "My cat Missy has been missing for 4 days. I know it's silly to pray about a cat but she's family. Please bring her home safe.", author_name: "Ingrid" },
  { church_slug: "crc-church", content: "I have a court date tomorrow. I made mistakes and I'm facing the consequences. Pray for God's mercy and a fair outcome.", author_name: null },
  { church_slug: "soweto-gospel-choir", content: "Thank you Lord for my grandmother who raised 7 children alone and still sang hymns every morning. I am who I am because she prayed.", author_name: "Sipho" },
  { church_slug: "bangsar-gospel-centre", content: "Pray for my dad who just retired. He doesn't know what to do with himself. He gave everything to his work and now feels lost.", author_name: "Wei Lin" },
  { church_slug: "aalborg-citykirke", content: "Herre, tak for denne dag. Selv på de svære dage er du trofast. Hjælp mig at huske det i morgen.", author_name: "Mads" },
  { church_slug: "agape-church-antwerpen", content: "My neighbor is elderly and lives alone. I've been bringing her groceries but she needs more than food. Pray I can be a real friend to her.", author_name: "Fatou" },
  { church_slug: "bethany-fellowship-full-gospel-church-claremont-cape-town", content: "We had a break-in last night. Nobody was hurt but my children are scared. Lord, be our shield and give us peace in our home.", author_name: "Thandi" },
  { church_slug: "air-itam-gospel-centre", content: "Pray for my village in Penang. The flooding damaged many homes. People lost everything. God, send help and restore what was taken.", author_name: null },
  { church_slug: "american-church-in-paris", content: "I moved to Paris for love and it didn't work out. Now I'm alone in a foreign city. But I found this church and it feels like maybe God brought me here for a reason.", author_name: "Rachel" },
  { church_slug: "malaga-christian-church", content: "Thank you God for the expat community here in Malaga. We came from different countries but found family in this church. Bless every person who walks through these doors.", author_name: "David" },
  { church_slug: "abbey-road-baptist-church", content: "Pray for the homeless man who sits outside our church every Sunday. We bring him tea but he needs so much more. Lord, show us how to help.", author_name: "Helen" },
  { church_slug: "adventgemeinde-zurich-cramerstrasse", content: "Herr, ich bin so müde. Die Arbeit, die Kinder, alles ist zu viel. Gib mir Kraft für morgen. Einfach nur für morgen.", author_name: "Katrin" },
];

// Spread created_at over the past 30 days for realism
function randomCreatedAt() {
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const offset = Math.floor(Math.random() * thirtyDaysMs);
  return new Date(now - offset).toISOString();
}

function randomPrayedCount() {
  // Most prayers get 0-5, some get more, a few go viral
  const r = Math.random();
  if (r < 0.5) return Math.floor(Math.random() * 6);
  if (r < 0.85) return Math.floor(Math.random() * 20) + 5;
  return Math.floor(Math.random() * 60) + 20;
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

  const churches = new Set(prayers.map((p) => p.church_slug));
  console.log(`Done! Inserted ${data.length} prayers across ${churches.size} churches`);
}

main();
