#!/usr/bin/env node
/**
 * church-audit.mjs — per-church "visibility audit" for SEO/GEO outreach.
 *
 * Combines DB signals we already own (Google reviews/rating, website platform,
 * Google Business Profile data from raw_google_places), a LIVE homepage check
 * (schema.org markup, service times on page, mobile), and LIVE search-visibility
 * (Google organic rank + Google AI Overview citation via Apify, plus a
 * best-effort Gemini-grounded mention check) into an email-ready "here's your
 * gap" summary per prospect. The search-invisibility line is the real pitch:
 * these churches are often well-kept but still don't show up when people search.
 *
 * ICP filter (city mode): on-brand (excl. Catholic/Orthodox/mainline-liturgical),
 * coordinate-verified to the metro, weak-tech OR just big, deduped, ranked by reviews.
 *
 * Usage:
 *   node scripts/church-audit.mjs --city=jacksonville --limit=8
 *   node scripts/church-audit.mjs --city=tampa --limit=10 --no-serp
 *   node scripts/church-audit.mjs --slugs=a,b,c --out=/tmp/audit.md
 *
 * Read-only on the DB. Fetches prospect homepages + runs Apify search
 * (~1 query per city) + optional Gemini calls. Sends nothing anywhere.
 */
import { neon } from "@neondatabase/serverless";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/local-env.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const OFF_BRAND = new Set(
  [
    "catholic", "roman catholic", "orthodox", "greek orthodox", "russian orthodox",
    "eastern orthodox", "coptic orthodox", "episcopal", "anglican", "lutheran",
    "presbyterian", "methodist", "united methodist", "free methodist", "ame", "cme",
    "seventh-day adventist", "adventist", "mormon", "latter-day saints", "lds",
    "unitarian", "quaker", "united church of christ",
  ].map((s) => s.toLowerCase()),
);
const CITY_BOX = {
  jacksonville: { latMin: 29.9, latMax: 30.7, lngMin: -82.1, lngMax: -81.3, display: "Jacksonville, FL" },
  "san-antonio": { latMin: 29.1, latMax: 29.8, lngMin: -98.9, lngMax: -98.2, display: "San Antonio, TX" },
  tampa: { latMin: 27.6, latMax: 28.2, lngMin: -82.7, lngMax: -82.2, display: "Tampa, FL" },
};
const DIY = new Set(["wix", "squarespace", "weebly", "godaddy", "google sites"]);
const SERP_DEPTH = 30;

function parseArgs(argv) {
  const o = { city: "", slugs: [], limit: 8, out: "", csv: "", serp: true, gemini: true };
  for (const a of argv) {
    if (a.startsWith("--city=")) o.city = a.split("=")[1];
    else if (a.startsWith("--slugs=")) o.slugs = a.split("=")[1].split(",").map((s) => s.trim()).filter(Boolean);
    else if (a.startsWith("--limit=")) o.limit = Math.max(1, Number(a.split("=")[1]) || 8);
    else if (a.startsWith("--out=")) o.out = a.split("=")[1];
    else if (a.startsWith("--csv=")) o.csv = a.split("=")[1];
    else if (a === "--no-serp") o.serp = false;
    else if (a === "--no-gemini") o.gemini = false;
  }
  return o;
}

function normName(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(church|iglesia|ministries?|inc|the|of|christian|fellowship|center|centre)\b/g, " ")
    .replace(/\s+/g, " ").trim();
}
function domainOf(url) {
  try { return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return ""; }
}
// Reject junk emails scraped off sites (Wix/Sentry DSNs, placeholders, image
// filenames, noreply) — sending to these bounces and burns sender reputation.
function validEmail(e) {
  const s = String(e || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(s)) return false;
  if (/(sentry|wixpress|\.wix\.|example\.|placeholder|noreply|no-reply|donotreply|do-not-reply)/.test(s)) return false;
  if (/\.(png|jpe?g|gif|svg|webp)$/.test(s)) return false;
  return true;
}
function cityDisplay(o, r) {
  if (o.city && CITY_BOX[o.city]) return CITY_BOX[o.city].display;
  if (o.city) return o.city.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return (r && r.location) || "";
}

async function fetchHomepage(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 9000);
    const res = await fetch(url, { redirect: "follow", signal: ctrl.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; GospelChannelAudit/1.0; +https://gospelchannel.com)" } });
    clearTimeout(t);
    return { status: res.status, html: await res.text() };
  } catch (e) { return { status: 0, html: "", error: e.message }; }
}
function analyzeHtml(html) {
  const lower = html.toLowerCase();
  const ld = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  const types = new Set();
  for (const m of ld) {
    try {
      const j = JSON.parse(m[1].trim());
      const arr = Array.isArray(j) ? j : (j["@graph"] || [j]);
      for (const n of arr) if (n && n["@type"]) [].concat(n["@type"]).forEach((t) => types.add(String(t)));
    } catch { /* ignore malformed */ }
  }
  return {
    hasLdJson: ld.length > 0,
    schemaTypes: [...types],
    hasChurchSchema: [...types].some((t) => /church|placeofworship|localbusiness|organization/i.test(t)),
    hasViewport: /<meta[^>]+name=["']viewport/i.test(html),
    mentionsServiceTimes: /(service times|sunday service|worship (with us|times|service)|join us (sunday|this))/i.test(lower),
  };
}
function gbpSignals(raw) {
  if (!raw || typeof raw !== "object") return { hasHours: false, hasWebsiteOnGbp: false, photos: 0 };
  return { hasHours: Array.isArray(raw.openingHours) && raw.openingHours.length > 0, hasWebsiteOnGbp: !!raw.website, photos: Array.isArray(raw.imageUrls) ? raw.imageUrls.length : (raw.imagesCount || 0) };
}

// ---- live search visibility ----
async function apifySerp(cityDisp, token) {
  const body = { queries: `churches in ${cityDisp}`, resultsPerPage: SERP_DEPTH, maxPagesPerQuery: 2, countryCode: "us", languageCode: "en", saveHtml: false };
  const url = `https://api.apify.com/v2/acts/apify~google-search-scraper/run-sync-get-dataset-items?token=${token}`;
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Apify SERP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const items = await res.json();
  const it = Array.isArray(items) ? items[0] : items;
  const organic = (it && it.organicResults) || [];
  const ai = it && (it.aiModeResult || it.aiOverview || it.aiOverviewResult) || null;
  const aiSources = ai && Array.isArray(ai.sources) ? ai.sources.map((s) => domainOf(s.url || s.link || "")).filter(Boolean) : [];
  const org = organic.map((r, i) => ({ position: r.position || i + 1, domain: domainOf(r.url || ""), title: r.title || "" }));
  return {
    organic: org,
    count: org.length,
    topDomains: [...new Set(org.map((x) => x.domain).filter(Boolean))].slice(0, 5),
    aiPresent: !!ai,
    aiDomains: aiSources,
    aiText: ai ? (ai.text || "") : "",
  };
}
async function geminiVisibility(cityDisp, key) {
  const model = "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const body = { contents: [{ parts: [{ text: `List the notable, active churches in ${cityDisp} that someone new to the area should consider visiting. Include each church's name and website.` }] }], tools: [{ google_search: {} }] };
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 150)}`);
  const j = await res.json();
  const cand = j.candidates && j.candidates[0];
  const text = cand && cand.content && cand.content.parts ? cand.content.parts.map((p) => p.text || "").join(" ") : "";
  const chunks = cand && cand.groundingMetadata && cand.groundingMetadata.groundingChunks || [];
  const titles = chunks.map((c) => (c.web && c.web.title) || "").join(" ");
  return { text, haystack: `${text} ${titles}`.toLowerCase() };
}

async function selectTargets(sql, o) {
  if (o.slugs.length) {
    return sql`SELECT c.slug,c.name,c.location,c.city_slug,c.denomination,c.website,c.header_image,c.service_times,
      e.google_reviews_count AS reviews,e.google_rating AS rating,e.latitude AS lat,e.longitude AS lng,e.raw_google_places AS raw,
      t.primary_platform AS platform,t.http_status,c.email AS church_email,e.contact_email AS contact_email,e.pastor_name
      FROM churches c JOIN church_enrichments e ON e.church_slug=c.slug LEFT JOIN church_website_tech t ON t.church_slug=c.slug
      WHERE c.slug = ANY(${o.slugs}::text[])`;
  }
  return sql`SELECT c.slug,c.name,c.location,c.city_slug,c.denomination,c.website,c.header_image,c.service_times,
    e.google_reviews_count AS reviews,e.google_rating AS rating,e.latitude AS lat,e.longitude AS lng,e.raw_google_places AS raw,
    t.primary_platform AS platform,t.http_status,c.email AS church_email,e.contact_email AS contact_email,e.pastor_name
    FROM churches c JOIN church_enrichments e ON e.church_slug=c.slug LEFT JOIN church_website_tech t ON t.church_slug=c.slug
    WHERE c.city_slug=${o.city} AND c.status='approved' AND e.google_reviews_count IS NOT NULL
    ORDER BY e.google_reviews_count DESC`;
}
function passesIcp(r, o, box) {
  if (OFF_BRAND.has((r.denomination || "").toLowerCase())) return false;
  if (/basilica|shrine|cathedral|catholic|diocese|mission conce/i.test(r.name || "")) return false;
  if (box && (r.lat == null || r.lng == null || r.lat < box.latMin || r.lat > box.latMax || r.lng < box.lngMin || r.lng > box.lngMax)) return false;
  if (o.slugs.length) return true;
  const plat = (r.platform || "").toLowerCase();
  return !r.website || DIY.has(plat) || (r.http_status != null && (r.http_status < 200 || r.http_status > 299));
}

function emailHook(a, cityDisp) {
  const rev = a.reviews != null ? `${a.reviews} Google-omdömen${a.rating != null ? ` (${a.rating}★)` : ""}` : "en aktiv församling";
  const lead = a.gaps[0] || "er lokala synlighet kan stärkas";
  return `Ni är en av ${cityDisp.split(",")[0]}s mest recenserade kyrkor — ${rev} — men ${lead.charAt(0).toLowerCase()}${lead.slice(1)}. Det fixar vi.`;
}

async function main() {
  loadLocalEnv(ROOT);
  const o = parseArgs(process.argv.slice(2));
  if (!o.city && !o.slugs.length) throw new Error("Pass --city=<slug> or --slugs=a,b,c");
  const sql = neon(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);
  const box = CITY_BOX[o.city];
  if (o.city && !box) console.warn(`WARN: no coord box for "${o.city}" — skipping geo-verification.`);
  const apifyToken = process.env.APIFY_TOKEN;
  const geminiKey = process.env.GEMINI_API_KEY;

  const rows = await selectTargets(sql, o);
  const seen = new Set();
  const picked = [];
  for (const r of rows) {
    if (!passesIcp(r, o, box)) continue;
    const key = normName(r.name);
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(r);
    if (!o.slugs.length && picked.length >= o.limit) break;
  }
  console.log(`Auditing ${picked.length} churches${o.city ? ` in ${o.city}` : ""} (homepage + SERP + AI)...`);

  const serpCache = new Map();
  const gemCache = new Map();
  async function serpFor(cityDisp) {
    if (!o.serp || !apifyToken) return null;
    if (serpCache.has(cityDisp)) return serpCache.get(cityDisp);
    let v = null;
    try { v = await apifySerp(cityDisp, apifyToken); console.log(`  SERP "${cityDisp}": ${v.organic.length} organic, AI Overview ${v.aiPresent ? "present" : "none"}`); }
    catch (e) { console.log(`  SERP "${cityDisp}" failed: ${e.message}`); }
    serpCache.set(cityDisp, v);
    return v;
  }
  async function gemFor(cityDisp) {
    if (!o.gemini || !geminiKey) return null;
    if (gemCache.has(cityDisp)) return gemCache.get(cityDisp);
    let v = null;
    try { v = await geminiVisibility(cityDisp, geminiKey); console.log(`  Gemini "${cityDisp}": ${v.text.length} chars grounded`); }
    catch (e) { console.log(`  Gemini "${cityDisp}" failed: ${e.message}`); }
    gemCache.set(cityDisp, v);
    return v;
  }

  const audits = [];
  for (const r of picked) {
    const cityDisp = cityDisplay(o, r);
    const gbp = gbpSignals(r.raw);
    const page = r.website ? await fetchHomepage(r.website) : null;
    const html = page && page.html ? analyzeHtml(page.html) : null;
    const serp = await serpFor(cityDisp);
    const gem = await gemFor(cityDisp);
    const dom = domainOf(r.website || "");

    // search-visibility signals
    let rank = null, aiCited = null, geminiSeen = null;
    if (serp && dom) {
      const hit = serp.organic.find((x) => x.domain && (x.domain === dom || x.domain.endsWith(`.${dom}`) || dom.endsWith(`.${x.domain}`)));
      rank = hit ? hit.position : null;
      if (serp.aiPresent) aiCited = serp.aiDomains.includes(dom);
    }
    if (gem) {
      const nm = normName(r.name);
      const firstToken = nm.split(" ")[0] || "";
      geminiSeen = (dom && gem.haystack.includes(dom)) || (nm.length > 3 && gem.haystack.includes(nm)) || (firstToken.length > 4 && gem.haystack.includes(firstToken) && gem.haystack.includes("church"));
    }

    // gaps — search-invisibility FIRST (that's the pitch)
    const plat = (r.platform || "").toLowerCase();
    const gaps = [];
    if (serp) {
      const who = serp.topDomains.length ? ` (Google visar istället ${serp.topDomains.slice(0, 3).join(", ")})` : "";
      if (rank == null) gaps.push(`ni syns inte bland de ${serp.count} organiska träffarna när folk googlar "churches in ${cityDisp.split(",")[0]}"${who}`);
      else if (rank > 5) gaps.push(`ni dyker först upp på plats ${rank} för "churches in ${cityDisp.split(",")[0]}"`);
      if (serp.aiPresent && aiCited === false) gaps.push(`Google visar ett AI-svar för sökningen men nämner inte er`);
    }
    if (gem && geminiSeen === false) gaps.push(`när man frågar en AI om kyrkor i ${cityDisp.split(",")[0]} nämns ni inte`);
    if (!r.website) gaps.push("ni har ingen egen hemsida alls");
    else if (DIY.has(plat)) gaps.push(`er sajt är byggd på ${r.platform} (gör-det-själv-verktyg)`);
    if (page && page.status && (page.status < 200 || page.status >= 400)) gaps.push(`er sajt svarar med fel (HTTP ${page.status})`);
    if (html && !html.hasChurchSchema) gaps.push("er sajt saknar strukturerad data (schema.org) så AI-motorer och Google inte kan läsa er som kyrka");
    if (html && !html.mentionsServiceTimes) gaps.push("era gudstjänsttider syns inte på förstasidan");
    if (html && !html.hasViewport) gaps.push("er sajt är inte mobilanpassad");
    if (!gbp.hasHours) gaps.push("er Google-profil saknar öppettider");

    audits.push({ ...r, cityDisp, gbp, html, pageStatus: page ? page.status : null, rank, aiCited, geminiSeen, serpOk: !!serp, serpCount: serp ? serp.count : null, topDomains: serp ? serp.topDomains : [], gemOk: !!gem, gaps });
  }

  // ---- report ----
  const L = [];
  L.push(`# Kyrko-synlighets-audit — ${o.city || "slug-lista"}`);
  L.push(`Genererad ${new Date().toISOString()} · ${audits.length} prospekt · Neon + live förstasidor + Google SERP/AI + Gemini`);
  L.push("");
  for (const a of audits) {
    L.push(`## ${a.name} — ${a.reviews}★ omdömen (${a.rating ?? "?"}★)`);
    L.push(`- **Plats:** ${a.location || "?"} · **Samfund:** ${a.denomination || "?"} · **Plattform:** ${a.platform || (a.website ? "okänd" : "INGEN SAJT")}`);
    L.push(`- **Hemsida:** ${a.website || "—"}${a.pageStatus != null ? ` (HTTP ${a.pageStatus})` : ""}`);
    if (a.serpOk) L.push(`- **Google-rank ("churches in ${a.cityDisp.split(",")[0]}"):** ${a.rank != null ? `plats ${a.rank}` : `inte bland ${a.serpCount} organiska`} · rankar istället: ${a.topDomains.slice(0, 3).join(", ") || "?"} · **AI Overview:** ${a.aiCited == null ? "inget AI-svar" : (a.aiCited ? "nämner er" : "nämner er INTE")}`);
    if (a.gemOk) L.push(`- **AI (Gemini) nämner er:** ${a.geminiSeen ? "ja" : "NEJ"}`);
    if (a.html) L.push(`- **Schema.org:** ${a.html.hasChurchSchema ? "ja" : (a.html.hasLdJson ? "finns men ingen kyrko-typ" : "NEJ")} · **Gudstjänsttider på sajt:** ${a.html.mentionsServiceTimes ? "ja" : "NEJ"} · **Mobil:** ${a.html.hasViewport ? "ja" : "NEJ"}`);
    L.push(`- **Google-profil:** öppettider ${a.gbp.hasHours ? "ja" : "NEJ"} · webblänk ${a.gbp.hasWebsiteOnGbp ? "ja" : "NEJ"}`);
    L.push(`- **Luckor (${a.gaps.length}):** ${a.gaps.join("; ") || "inga uppenbara"}`);
    L.push(`- **Mail-krok:** ${emailHook(a, a.cityDisp)}`);
    L.push("");
  }
  const report = L.join("\n");
  const outPath = o.out || join(ROOT, `church-audit-${o.city || "slugs"}.md`);
  writeFileSync(outPath, report);
  if (o.csv) {
    const esc = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const head = ["email", "firstName", "churchName", "city", "reviews", "rating", "website", "competitors", "gapHook", "fullHook", "slug"];
    const lines = [head.join(",")];
    let n = 0, skipped = 0;
    for (const a of audits) {
      const email = [a.church_email, a.contact_email].find(validEmail) || "";
      if (!email) { skipped += 1; continue; }
      const firstName = a.pastor_name ? String(a.pastor_name).trim().split(/\s+/)[0] : "";
      const row = [email, firstName, a.name, a.cityDisp.split(",")[0], a.reviews ?? "", a.rating ?? "", a.website || "", (a.topDomains || []).slice(0, 3).join(", "), a.gaps[0] || "", emailHook(a, a.cityDisp), a.slug];
      lines.push(row.map(esc).join(","));
      n += 1;
    }
    writeFileSync(o.csv, lines.join("\n") + "\n");
    console.log(`CSV written: ${o.csv} (${n} emailable rows, ${skipped} skipped for no email)`);
  }
  console.log(`\nReport written: ${outPath}\n\nSUMMARY:`);
  for (const a of audits) {
    const rk = a.rank != null ? `#${a.rank}` : (a.serpOk ? `>${a.serpCount}` : "?");
    const ai = a.aiCited == null ? "-" : (a.aiCited ? "AI✓" : "AI✗");
    const gm = a.gemOk ? (a.geminiSeen ? "G✓" : "G✗") : "-";
    console.log(`  ${String(a.reviews).padStart(4)}★  rank ${rk.padEnd(4)} ${ai.padEnd(4)} ${gm.padEnd(3)} ${a.gaps.length}gaps  ${a.name}`);
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
