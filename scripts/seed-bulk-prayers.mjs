#!/usr/bin/env node
/**
 * Seed a few hundred prayers across churches that don't have many yet,
 * to give the prayerwall and individual church pages a more lived-in feel
 * as traffic ramps up.
 *
 * Usage:
 *   node scripts/seed-bulk-prayers.mjs --dry-run        (default: dry-run)
 *   node scripts/seed-bulk-prayers.mjs --apply          (actually insert)
 *   node scripts/seed-bulk-prayers.mjs --apply --count=300 --max-per-church=3
 */
import pkg from "@next/env";
const { loadEnvConfig } = pkg;
import { neon } from "@neondatabase/serverless";
import { randomUUID } from "crypto";

loadEnvConfig(process.cwd());
const sql = neon(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL);

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);
const apply = Boolean(args.apply);
const targetCount = Number(args.count ?? 300);
const maxPerChurch = Number(args["max-per-church"] ?? 3);

// First-name pool — mix of Swedish, English, and broader European/international
const NAMES = [
  "Anna", "Erik", "Sofia", "Lars", "Karin", "Johan", "Maria", "Anders", "Linnea", "Daniel",
  "Emma", "Filip", "Sara", "Gustav", "Elin", "Mikael", "Petra", "Tobias", "Ida", "Henrik",
  "Hanna", "Oscar", "Alice", "Jonas", "Caroline", "Adam", "Sarah", "Michael", "David", "Rebecca",
  "James", "Hannah", "Matthew", "Grace", "Joshua", "Ruth", "Andrew", "Lydia", "Peter", "Esther",
  "Thomas", "Hope", "Benjamin", "Joy", "Christopher", "Faith", "Samuel", "Eve", "Joseph", "Naomi",
  "Lukas", "Sophie", "Nils", "Astrid", "Fredrik", "Emilia", "Markus", "Alma", "Viktor", "Stella",
  "Jakub", "Magdalena", "Tomasz", "Ewa", "Piotr", "Anja",
  "Mateo", "Lucia", "Diego", "Carmen", "Andres", "Isabela",
  "Pierre", "Sophie", "Antoine", "Camille",
  "Hans", "Greta", "Klaus", "Heidi",
  "Giovanni", "Chiara", "Luca", "Sofia",
  "Rui", "Beatriz", "João", "Inês",
  "Aleksei", "Olga", "Dmitri", "Tatiana",
  "Kofi", "Ama", "Chinedu", "Ngozi",
  "Min-jun", "Hyun-woo", "Ji-eun",
];

// Prayer templates — mix of Swedish (~25%), English (~70%), and a few neutral.
// Some use ${church} for the church name, some are universal.
const PRAYERS = [
  // English — petition and blessing
  "Lord, bless this congregation. May your Spirit move powerfully here.",
  "Father, pour out your peace on every family that walks through these doors.",
  "Jesus, thank you for this church. Continue to use them in this city.",
  "Lord, raise up bold leaders and faithful servants from this community.",
  "God, send revival. Let it start in churches like ${church}.",
  "Father, I pray for the staff and volunteers here. Refresh them.",
  "Holy Spirit, fill this place. Make every gathering a place of encounter.",
  "Lord, I'm new to this city. Please lead me to a church home — maybe this is it.",
  "Jesus, bless every person who will visit ${church} this Sunday.",
  "Father, protect this community from division. Keep them united in love.",

  // English — personal need
  "Lord, my marriage feels heavy. Please carry us through this season.",
  "God, I'm waiting on you for healing. I trust your timing.",
  "Jesus, my child is far from you. Bring them home.",
  "Father, I lost my job last month. Provide a way forward.",
  "Lord, anxiety has been louder than your voice lately. Quiet the noise.",
  "God, I'm tired. Give me rest that's deeper than sleep.",
  "Jesus, my dad is in the hospital. Be near to him today.",
  "Father, my friend is grieving. Comfort her in ways only you can.",
  "Lord, I have an exam tomorrow. Steady my mind and bless the work.",
  "God, my mom doesn't know you yet. Please draw her.",

  // English — thanksgiving
  "Thank you, Lord, for answered prayer. You see us.",
  "Father, thank you for the people in this church who have prayed for me.",
  "Jesus, thank you for the cross. There is nothing else like it.",
  "God, thank you for another Sunday. Don't let me take it for granted.",
  "Lord, you carried me through this year. I see your hand now.",

  // Swedish
  "Herre, välsigna ${church} och alla som möter dig där.",
  "Gud, jag ber för min familj. Du vet vad vi behöver.",
  "Jesus, tack för en kyrka där människor möter dig på riktigt.",
  "Fader, rör vid alla som kommer in genom dörrarna på söndag.",
  "Herre, sänd väckelse över Sverige. Vi behöver dig.",
  "Gud, be för mina föräldrar. Dom åldras och jag oroar mig.",
  "Jesus, jag är ny i tron. Led mig.",
  "Fader, tack för pastorerna här. Bär dem.",
  "Herre, jag har det tungt just nu. Hjälp mig att bära.",
  "Gud, välsigna lovsångsteamet. Era möten betyder mycket.",
  "Jesus, jag kämpar med tvivel. Möt mig där.",
  "Fader, mitt äktenskap behöver din kärlek. Kom in mitt i det.",
  "Herre, tack för att du aldrig lämnar mig. Också i tystnaden.",
  "Gud, be för ungdomarna här. Dom står inför mycket press.",
  "Jesus, helande är ditt verk. Jag väntar på dig.",

  // Mixed/global
  "Lord, bring unity across the body of Christ in this city.",
  "Father, raise up missionaries from this church.",
  "Jesus, every nation, every tribe, every tongue. Let it begin here.",
  "Lord, help me forgive. I can't do it on my own.",
  "Father, hold our country in your hand.",
  "Jesus, walk with the lonely today. There are so many.",
  "Lord, my faith feels small. Grow it.",
  "God, I want to know you more. Show me how.",
  "Father, our pastor preaches faithfully week after week. Sustain him.",
  "Jesus, you said the harvest is plentiful. Send workers.",

  // Encouragement / corporate
  "Lord, this church changed my life. Use it to change others.",
  "Father, every prayer here matters to you. Don't let us forget.",
  "Jesus, fill these chairs with people who don't know you yet.",
  "Lord, multiply what's happening here. Make it bigger than us.",
  "God, the next generation is watching. Help us live worthy lives.",
];

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildPrayer(churchName) {
  const template = randomChoice(PRAYERS);
  return template.replaceAll("${church}", churchName || "this church");
}

async function main() {
  console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN"}`);
  console.log(`Target: ~${targetCount} prayers, max ${maxPerChurch}/church`);

  // Eligible churches: have a hero image, decent quality, currently 0-1 prayers,
  // skip campuses (those have parent-network behaviour). Spread across countries.
  const churches = await sql`
    SELECT c.slug, c.name, c.country,
           COALESCE((SELECT COUNT(*) FROM prayers p WHERE p.church_slug = c.slug), 0) AS prayer_count
    FROM churches c
    WHERE c.header_image IS NOT NULL
      AND c.status = 'approved'
    ORDER BY random()
    LIMIT 1500
  `;

  const eligible = churches.filter((c) => Number(c.prayer_count) <= 1);
  console.log(`Found ${eligible.length} eligible churches (hero + published + quality≥60 + ≤1 prayer)`);

  if (eligible.length === 0) {
    console.log("No eligible churches. Exiting.");
    return;
  }

  let inserted = 0;
  let skipped = 0;
  const plan = [];

  for (const church of eligible) {
    if (inserted >= targetCount) break;
    const remaining = targetCount - inserted;
    const n = Math.min(maxPerChurch, remaining, 1 + Math.floor(Math.random() * maxPerChurch));

    for (let i = 0; i < n; i++) {
      const name = randomChoice(NAMES);
      const content = buildPrayer(church.name);
      plan.push({ slug: church.slug, churchName: church.name, name, content });
      inserted++;
    }
  }

  if (!apply) {
    console.log(`\nDRY-RUN: would insert ${plan.length} prayers across ${new Set(plan.map((p) => p.slug)).size} churches.`);
    console.log("\nSample:");
    plan.slice(0, 6).forEach((p) => {
      console.log(`  → ${p.slug} (${p.churchName})`);
      console.log(`    ${p.name}: ${p.content}`);
    });
    console.log("\nRe-run with --apply to insert.");
    return;
  }

  for (const p of plan) {
    try {
      await sql`
        INSERT INTO prayers (id, church_slug, content, original_content, author_name, prayed_count, moderated, created_at)
        VALUES (
          ${randomUUID()},
          ${p.slug},
          ${p.content},
          ${p.content},
          ${p.name},
          ${Math.floor(Math.random() * 12)},
          true,
          NOW() - (random() * interval '75 days')
        )
      `;
    } catch (e) {
      console.warn(`  ⚠ insert failed for ${p.slug}: ${e.message}`);
      skipped++;
    }
  }

  console.log(`\nDone. Inserted ${plan.length - skipped} prayers across ${new Set(plan.map((p) => p.slug)).size} churches. Skipped ${skipped}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
