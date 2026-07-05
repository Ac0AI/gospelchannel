#!/usr/bin/env node
// Generate per-church English "free breakdown" docs (the deliverable promised in the
// lemlist US SEO/GEO outreach) + per-lead gapText for the campaign emails.
//
// Sources: data/audits/<city>-audit-v2.md (per-church visibility audit, Swedish)
//          data/audits/lemlist-leads-all.csv (the 29 outreach leads)
// Output:  data/audits/breakdowns/<slug>.md   (English, email-pastable)
//          data/audits/breakdowns/INDEX.md
//          data/audits/breakdowns/gaptext.json (per-lead email/slug/gapText for lemlist)
//
// data/audits/ is gitignored (contains outreach PII); keep it that way.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const AUDITS = path.join(ROOT, "data", "audits");
const OUT = path.join(AUDITS, "breakdowns");
const CITIES = { jacksonville: "Jacksonville", "san-antonio": "San Antonio", tampa: "Tampa" };
const today = new Date().toISOString().slice(0, 10);

function parseCSV(t) {
  const rows = [];
  let row = [], cur = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else {
      if (c === '"') q = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (c !== "\r") cur += c;
    }
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

// --- parse audit markdown into per-church records ---
function parseAudit(citySlug, cityName) {
  const md = fs.readFileSync(path.join(AUDITS, `${citySlug}-audit-v2.md`), "utf8");
  const blocks = md.split(/^## /m).slice(1);
  return blocks.map((b) => {
    const lines = b.split("\n");
    const head = lines[0].match(/^(.+) — (\d+)★ omdömen \(([\d.]+)★\)/);
    const get = (re) => { const m = b.match(re); return m ? m[1].trim() : null; };
    const rankLine = get(/\*\*Google-rank [^:]+:\*\* ([^\n]+)/) || "";
    const rankPos = rankLine.match(/plats (\d+)/);
    const topN = rankLine.match(/inte bland (\d+) organiska/);
    const site = get(/\*\*Hemsida:\*\* ([^\n]+)/) || "—";
    const httpMatch = site.match(/HTTP (\d+)/);
    return {
      city: cityName,
      name: head[1].trim(),
      reviews: head[2],
      rating: head[3],
      platform: get(/\*\*Plattform:\*\* ([^\n]+)/),
      siteUrl: (site.match(/(https?:\/\/\S+)/) || [])[1] || null,
      siteHttp: httpMatch ? Number(httpMatch[1]) : null,
      rank: rankPos ? Number(rankPos[1]) : null,
      topN: topN ? Number(topN[1]) : rankPos ? 8 : null,
      competitors: (rankLine.match(/rankar istället: ([^·]+)/) || [, ""])[1].trim(),
      gemini: /\*\*AI \(Gemini\) nämner er:\*\* ja/.test(b),
      schema: /\*\*Schema\.org:\*\* ja/.test(b) ? "ok" : /finns men ingen kyrko-typ/.test(b) ? "no-type" : b.includes("**Schema.org:**") ? "missing" : null,
      timesOnSite: b.includes("**Gudstjänsttider på sajt:**") ? /\*\*Gudstjänsttider på sajt:\*\* ja/.test(b) : null,
      gbpHours: /öppettider ja/.test(b),
      gbpWebsite: /webblänk ja/.test(b),
    };
  });
}

const audit = Object.entries(CITIES).flatMap(([slug, name]) => parseAudit(slug, name));

// ChatGPT visibility (gpt-4o + web_search, 2 runs/city, eyeball-verified) — optional overlay
const chatgptFile = path.join(OUT, "chatgpt-visibility.json");
const chatgpt = fs.existsSync(chatgptFile)
  ? Object.fromEntries(JSON.parse(fs.readFileSync(chatgptFile, "utf8")).result.map((r) => [r.slug, r.mentioned]))
  : {};

// --- join with the 29 leads ---
const csv = parseCSV(fs.readFileSync(path.join(AUDITS, "lemlist-leads-all.csv"), "utf8"));
const header = csv[0];
const leads = csv.slice(1).filter((r) => r.length > 1 && r[0]).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] || "").trim()])));

fs.mkdirSync(OUT, { recursive: true });
const gaptexts = [];
const indexRows = [];

for (const lead of leads) {
  const a = audit.find((x) => x.name === lead.churchName && x.city === lead.city);
  if (!a) { console.error(`NO AUDIT MATCH: ${lead.churchName} (${lead.city})`); continue; }

  // --- gapText for the campaign email (follows "When someone searches \"churches in {city}\" on Google, ") ---
  // AI claim only where verified: both assistants missing → strongest claim (ChatGPT named for
  // recognition); only Gemini missing → Gemini-only; Gemini mentions them → no AI claim at all.
  const gptMentioned = chatgpt[lead.slug]; // true / false / undefined (not checked)
  const aiClause = a.gemini ? ""
    : gptMentioned === false ? ` Ask ChatGPT or Gemini about churches in ${a.city} and neither one mentions you.`
    : ` Ask Gemini, Google's AI assistant, about churches in ${a.city} and you're not mentioned there either.`;
  let gapText;
  if (a.rank) {
    gapText = `${a.name} first shows up at position ${a.rank}, below directory sites like ${a.competitors}. Most people never scroll that far.${aiClause} So a lot of the people actively looking for a church like yours are getting pointed somewhere else.`;
  } else {
    gapText = `${a.name} doesn't come up in the organic results. Directory sites like ${a.competitors} show up instead.${aiClause} So a lot of the people actively looking for a church like yours are getting pointed somewhere else.`;
  }
  gaptexts.push({ email: lead.email, slug: lead.slug, churchName: a.name, gapText });

  // --- the 3 fastest fixes, in impact order, only where the audit found the gap ---
  const fixes = [];
  if (a.siteHttp === 0) fixes.push(`**Check your website hosting.** When we ran this audit, ${a.siteUrl || "your website"} didn't respond at all. If that happens even some of the time, it quietly costs you both visitors and Google ranking. Worth confirming with whoever hosts the site.`);
  if (!a.gbpHours) fixes.push(`**Add your service times as hours on your Google Business Profile.** Your profile currently shows no hours. It takes about 10 minutes in business.google.com and it's often the first thing people check before visiting a church.`);
  if (a.schema === "no-type" || a.schema === "missing") fixes.push(`**Add Church structured data (schema.org) to your website.** ${a.schema === "no-type" ? "Your site has some structured data, but nothing that identifies it as a church" : "Your site has no structured data"}. This markup is how Google and AI assistants know you're a church in ${a.city} and not just a website. On ${a.platform === "Wix" || a.platform === "Squarespace" ? a.platform + " this is a copy-paste code block in settings" : "most platforms this is a small code snippet"}.`);
  if (a.timesOnSite === false) fixes.push(`**Put your service times in plain text on your homepage.** They're not there today. Visitors look for them first, and AI tools can only repeat what they can read.`);
  if (a.timesOnSite === null && !a.siteUrl) fixes.push(`**Get a simple one-page website.** You don't have one today, so directories and old listings speak for you. One page with your service times, address and a few photos is enough to start.`);
  if (!a.gemini) fixes.push(`**Make your listings agree with each other.** AI assistants lean on consistent citations: your Google profile, the big church directories (including your free GospelChannel listing) and your own site all stating the same name, address and service times. Right now ${gptMentioned === false ? "neither ChatGPT nor Gemini surfaces" : "Gemini doesn't surface"} you for ${a.city}; consistency is the fix that compounds.`);
  fixes.push(`**Publish a page that answers the actual search.** The sites winning "churches in ${a.city}" today (${a.competitors}) all have a page built around exactly that phrase. An honest "new here? visit us in ${a.city}" page on your own site competes for the same click.`);
  fixes.push(`**Keep your Google profile active.** Choose the most specific category, add photos from recent services, and post something short every week or two. Profiles with fresh activity hold their map-pack spot better than dormant ones.`);
  fixes.push(`**Turn your review strength into momentum.** ${a.reviews} reviews is an asset most churches in ${a.city} don't have. Reply to the recent ones and keep new ones coming; count and recency feed both the map pack and AI answers.`);
  const top3 = fixes.slice(0, 3);

  // --- the breakdown doc ---
  const rankLineEn = a.rank
    ? `you appear at position ${a.rank}. Everything above you is directory sites: ${a.competitors}.`
    : `you don't appear in the top ${a.topN} organic results. The sites that do: ${a.competitors}.`;
  const md = `# ${a.name} (${a.city}), free visibility breakdown

From David at GospelChannel, prepared ${today}. About a 2-minute read.

You have ${a.reviews} Google reviews at ${a.rating} stars. That's one of the highest counts among churches in ${a.city}, which means Google already trusts you locally. The gap is everything outside the map pin.

## Where you show up today

- **Google organic results for "churches in ${a.city}":** ${rankLineEn}
- **Gemini (Google's AI assistant), asked about churches in ${a.city}:** ${a.gemini ? "you are mentioned. That's genuinely good, and worth protecting." : "you're not mentioned."}
${gptMentioned === undefined ? "" : `- **ChatGPT, asked the same question:** ${gptMentioned ? "you are mentioned. That's genuinely good, and worth protecting." : "you're not mentioned."}\n`}
- **Your Google Business Profile:** hours ${a.gbpHours ? "listed" : "MISSING"}, website link ${a.gbpWebsite ? "present" : "MISSING"}.
${a.siteUrl ? `- **Your website** (${a.platform}): ${a.siteHttp === 0 ? "it didn't respond when we checked, so we couldn't review it" : `church structured data ${a.schema === "ok" ? "present" : a.schema === "no-type" ? "present but doesn't identify you as a church" : "missing"}${a.timesOnSite === null ? "" : `, service times on the homepage ${a.timesOnSite ? "visible" : "NOT visible"}`}`}.` : `- **Your website:** none found. Directories and old listings speak for you today.`}

Every month, people in ${a.city} search for a church and get sent to a directory instead of to you. That's the cost of this gap, and it's fixable.

## The 3 fastest fixes

${top3.map((f, i) => `${i + 1}. ${f}`).join("\n")}

## What this is

GospelChannel is a church directory; helping churches get found is the point. Everything above comes from a real check we ran in ${new Date(today).toLocaleString("en-US", { month: "long", year: "numeric" })} (Google results, Gemini, your site, your Google profile), not a template. If you'd rather have it done for you, that's a service we offer: flat monthly, no contract, cancel anytime. And if you do it yourselves, this list is everything you need to start.

Either way, reply and I'll happily explain any of it.

David
GospelChannel
`;
  fs.writeFileSync(path.join(OUT, `${lead.slug}.md`), md);
  indexRows.push(`- [${a.name}](${lead.slug}.md) — ${a.city} · ${a.reviews} reviews · ${a.rank ? `rank #${a.rank}` : "not in organic"} · Gemini ${a.gemini ? "YES" : "no"} · ${lead.email}`);
}

fs.writeFileSync(path.join(OUT, "INDEX.md"), `# Outreach breakdowns (${gaptexts.length} churches), generated ${today}\n\nSend the matching file as a reply when a church answers "yes" to the campaign email.\n\n${indexRows.join("\n")}\n`);
fs.writeFileSync(path.join(OUT, "gaptext.json"), JSON.stringify(gaptexts, null, 2));
console.log(`breakdowns: ${gaptexts.length} written to data/audits/breakdowns/`);
console.log(`gemini-mentioned (no AI claim in email): ${gaptexts.length - gaptexts.filter(g => g.gapText.includes("Gemini")).length}`);
