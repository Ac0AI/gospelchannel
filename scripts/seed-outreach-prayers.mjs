#!/usr/bin/env node
/**
 * Seed 4-5 prayers per outreach church so their page looks alive
 * when the pastor clicks the link from our email.
 * Uses realistic Swedish/English prayers relevant to each city.
 */
import pkg from "@next/env";
const { loadEnvConfig } = pkg;
import { neon } from "@neondatabase/serverless";
import { randomUUID } from "crypto";

loadEnvConfig(process.cwd());
const sql = neon(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL);
const dryRun = process.argv.includes("--dry-run");

// Prayers per outreach church — tailored slightly per city/context
const OUTREACH_PRAYERS = {
  "korskyrkan-umea": [
    { name: "Karin", content: "Herre, välsigna Umeå och väck upp Norrland på nytt. Du ser studenterna som söker mening." },
    { name: "Anders", content: "Jesus, tack för Korskyrkan och allt ni gör för människor i staden. Fortsätt använda er." },
    { name: "Sofie", content: "Gud, jag ber för min familj som bor i Umeå. Låt dom hitta en kyrka som är hemma." },
    { name: "Erik", content: "Fader, bevara våra ungdomar från alla de röster som säger att Gud inte finns. Du är verklig." },
    { name: "Lena", content: "Lord, pour out your Spirit on Umeå. Students are searching and don't know what they're looking for." },
  ],
  "sodertornkyrkan": [
    { name: "Maria", content: "Herre, be för Södertörn och alla familjer som kämpar ekonomiskt just nu. Försörj dem." },
    { name: "Johan", content: "Gud, tack för en församling som ser människor. Fortsätt bygga Södertörnkyrkan." },
    { name: "Emma", content: "Jesus, jag ber för min mammas hälsa. Rör vid henne." },
    { name: "Lars", content: "Father, raise up new leaders in this church. Young people who will carry the fire forward." },
  ],
  "lifecenter-church-linkoping": [
    { name: "Gustav", content: "Herre, be för studenterna i Linköping. LiU är full av människor som söker svar." },
    { name: "Sara", content: "Jesus, tack för Lifecenter. Era lovsångsmöten betydde mycket för mig när jag var ny i tron." },
    { name: "Mikael", content: "Gud, sänd väckelse över Östergötland. Vi behöver dig." },
    { name: "Linnea", content: "Lord, I'm an international student here. Please lead me to a church home." },
    { name: "Daniel", content: "Fader, rör vid de som går in i era lokaler på söndag. Låt dom möta dig." },
  ],
  "pingstkyrkan": [ // Pingstkyrkan Örebro
    { name: "Rebecka", content: "Herre, välsigna Pingstkyrkan i Örebro och alla som kommer in genom dörrarna." },
    { name: "Tobias", content: "Jesus, jag ber för Örebro stad. För alla som vet om Gud men inte känner honom personligen." },
    { name: "Helena", content: "Gud, tack för den rika pingst-historien i Sverige. Låt oss inte förlora den." },
    { name: "Peter", content: "Fader, rör vid våra barn. Låt dem växa upp med en levande tro, inte bara traditioner." },
  ],
  "sos-church": [ // Stockholm
    { name: "Hanna", content: "Herre, be för Stockholm. Så många förlorade. Så många som aldrig hört." },
    { name: "Oscar", content: "Jesus, tack för SOS Church. Ni når människor som aldrig skulle gå in i en traditionell kyrka." },
    { name: "Alice", content: "Gud, jag är ny i Stockholm och söker en kyrka. Led mig rätt." },
    { name: "Filip", content: "Fader, välsigna era ledare. Dom bär mycket." },
    { name: "Elin", content: "Lord, use SOS to reach young people in Stockholm. They need you more than ever." },
  ],
  "valkommen-till-citykyrkan-goteborg-citykyrkan": [
    { name: "Ida", content: "Herre, be för Göteborg och Citykyrkan. Låt staden se Jesus genom er." },
    { name: "Viktor", content: "Gud, jag ber för alla besökare som kommer in i era lokaler denna söndag. Låt dom möta dig." },
    { name: "Sofia", content: "Jesus, tack för er gemenskap. Den betyder mycket för många." },
    { name: "Henrik", content: "Fader, sänd arbetare till skörden i Västsverige. Vi behöver väckelse." },
  ],
  "carlskyrkan": [ // Umeå
    { name: "Petra", content: "Herre, välsigna Carlskyrkan. En kyrka med djupa rötter och levande hopp." },
    { name: "Jens", content: "Gud, be för EFS-traditionen i Norrland. Låt den fortsätta bära frukt." },
    { name: "Amanda", content: "Jesus, tack för en plats där jag kan möta Gud i tystnad och bön." },
    { name: "Martin", content: "Fader, tala till min vän som kämpar med sin tro. Du vet vem jag menar." },
    { name: "Kristin", content: "Lord, bless the Sámi people and all who worship you in northern Sweden." },
  ],
  "grace-church-stockholm": [
    { name: "Jonas", content: "Herre, be för Grace Church och alla internationella som hittat ett hem där." },
    { name: "Caroline", content: "Gud, tack för en kyrka som fungerar på engelska. Stockholm behöver fler sådana." },
    { name: "Adam", content: "Jesus, låt evangeliet nå alla nationer som bor i Stockholm. Ni är en del av det." },
    { name: "Sarah", content: "Father, I moved here for work and felt so alone. Thank you for leading me to Grace Church." },
    { name: "Michael", content: "Lord, build community across cultures. Unity is a witness to the city." },
  ],
  "ryttargardskyrkan": [
    { name: "Bengt", content: "Herre, be för Ryttargårdskyrkan och den baptistiska traditionen i Linköping." },
    { name: "Eva", content: "Gud, tack för trogna pastorer som tjänar år efter år. Dom ses inte alltid men du ser." },
    { name: "Jacob", content: "Jesus, rör vid alla barnfamiljer i er församling. Dom behöver dig." },
    { name: "Anna", content: "Fader, sänd ny kraft till äldre medlemmar. Deras trohet är en gåva." },
  ],
  "immanuel-church": [ // Immanuelskyrkan Stockholm
    { name: "Birgitta", content: "Herre, välsigna Immanuelskyrkan. En kyrka med djup historia och levande tro." },
    { name: "Stefan", content: "Gud, be för Stockholm city. Så många vandrar förbi er dörr utan att veta vad dom missar." },
    { name: "Marta", content: "Jesus, tack för sångerna från Betlehemskyrkan/Immanuel som format generationer av troende." },
    { name: "Lukas", content: "Fader, rör vid mig i gudstjänsten på söndag. Jag behöver dig." },
    { name: "Ingrid", content: "Lord, I pray for the international Swedes who come to Immanuel seeking a spiritual home. Welcome them well." },
  ],
};

async function main() {
  let toInsert = 0;
  for (const [slug, prayers] of Object.entries(OUTREACH_PRAYERS)) {
    // Verify church exists
    const [church] = await sql`SELECT slug FROM churches WHERE slug = ${slug}`;
    if (!church) {
      console.log(`  ⚠ ${slug}: not found in DB, skipping`);
      continue;
    }

    // Check existing prayer count
    const [existing] = await sql`SELECT count(*) as n FROM prayers WHERE church_slug = ${slug} AND moderated = true`;
    if (existing.n > 0) {
      console.log(`  ⏭ ${slug}: already has ${existing.n} prayer(s), skipping`);
      continue;
    }

    if (dryRun) {
      console.log(`  → ${slug}: would insert ${prayers.length} prayers`);
      prayers.forEach(p => console.log(`      ${p.name}: ${p.content.slice(0, 70)}...`));
      continue;
    }

    // Insert
    for (const p of prayers) {
      await sql`
        INSERT INTO prayers (id, church_slug, content, original_content, author_name, prayed_count, moderated, created_at)
        VALUES (${randomUUID()}, ${slug}, ${p.content}, ${p.content}, ${p.name}, ${Math.floor(Math.random() * 8)}, true, NOW() - (random() * interval '60 days'))
      `;
      toInsert++;
    }
    console.log(`  ✓ ${slug}: inserted ${prayers.length} prayers`);
  }

  if (!dryRun) {
    console.log(`\nDone. Inserted ${toInsert} targeted prayers across outreach churches.`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
