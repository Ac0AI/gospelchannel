#!/usr/bin/env node

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/local-env.mjs";
import { mapWithConcurrency } from "./lib/enrichment/rate-limiter.mjs";
import { extractEmailsFromHtml } from "./lib/website-contact.mjs";
import { normalizeHost } from "./lib/church-intake-utils.mjs";
import supabaseCompat from "../src/lib/supabase.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const PAGE_SIZE = 1000;
const EUROPE_COUNTRIES = new Set([
  "Albania","Andorra","Armenia","Austria","Azerbaijan","Belgium","Bulgaria","Croatia","Cyprus","Czech Republic",
  "Denmark","Estonia","Finland","France","Georgia","Germany","Greece","Hungary","Iceland","Ireland","Italy",
  "Latvia","Lithuania","Luxembourg","Macedonia","Malta","Moldova","Monaco","Netherlands","Norway","Poland",
  "Portugal","Romania","Serbia","Slovakia","Slovenia","Spain","Sweden","Switzerland","Turkey","Ukraine","United Kingdom",
]);

function parseArgs(argv) {
  const options = {
    limit: 0,
    preview: false,
    region: "europe",
    concurrency: 6,
    reasonPrefix: "",
    status: "pending",
  };

  for (const arg of argv) {
    if (arg === "--preview") options.preview = true;
    else if (arg.startsWith("--limit=")) options.limit = Math.max(0, Number(arg.split("=")[1]) || 0);
    else if (arg.startsWith("--region=")) options.region = arg.split("=")[1] || "europe";
    else if (arg.startsWith("--concurrency=")) options.concurrency = Math.max(1, Number(arg.split("=")[1]) || 6);
    else if (arg.startsWith("--reason-prefix=")) options.reasonPrefix = arg.split("=")[1] || "";
    else if (arg.startsWith("--status=")) options.status = arg.split("=")[1] || "pending";
  }

  return options;
}

function matchesRegion(country, region) {
  if (region !== "europe") return true;
  return EUROPE_COUNTRIES.has(country);
}

async function fetchHtml(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0)" },
    });
    if (!response.ok) return "";
    return await response.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

function absolutize(url, baseUrl) {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return "";
  }
}

function normalizeFacebookUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url, "https://www.facebook.com");
    if (!/facebook\.com$/i.test(parsed.hostname) && !/\.facebook\.com$/i.test(parsed.hostname)) return "";
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return "";
    const root = parts[0].toLowerCase();
    if (["share.php", "sharer.php", "dialog", "plugins", "photo.php", "watch", "reel", "reels", "stories"].includes(root)) {
      return "";
    }
    if (root === "profile.php") {
      const id = parsed.searchParams.get("id");
      return id ? `https://www.facebook.com/profile.php?id=${id}` : "";
    }
    return `https://www.facebook.com/${parts.join("/")}`;
  } catch {
    return "";
  }
}

function normalizeInstagramUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url, "https://www.instagram.com");
    if (!/instagram\.com$/i.test(parsed.hostname) && !/\.instagram\.com$/i.test(parsed.hostname)) return "";
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return "";
    const username = parts[0].replace(/^@/, "");
    if (!username) return "";
    if (["p", "reel", "reels", "stories", "explore", "tv", "accounts"].includes(username.toLowerCase())) return "";
    return `https://www.instagram.com/${username}/`;
  } catch {
    return "";
  }
}

function extractDirectYouTubeChannelId(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url, "https://www.youtube.com");
    if (!/youtube\.com$/i.test(parsed.hostname) && !/\.youtube\.com$/i.test(parsed.hostname)) return "";
    const match = parsed.pathname.match(/^\/channel\/(UC[A-Za-z0-9_-]{20,})$/i);
    return match?.[1] || "";
  } catch {
    return "";
  }
}

function normalizeYouTubeUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url, "https://www.youtube.com");
    const host = parsed.hostname.toLowerCase();
    if (host === "youtu.be") return "";
    if (!host.endsWith("youtube.com")) return "";
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return "";
    const first = parts[0];
    if (first.startsWith("@")) {
      return `https://www.youtube.com/${first}`;
    }
    if (first.toLowerCase() === "channel" && /^UC[A-Za-z0-9_-]{20,}$/i.test(parts[1] || "")) {
      return `https://www.youtube.com/${first}/${parts[1]}`;
    }
    if (["user", "c"].includes(first.toLowerCase()) && parts[1]) {
      return `https://www.youtube.com/${first}/${parts[1]}`;
    }
    if (parts.length === 1 && !["watch", "playlist", "results", "feed", "shorts", "embed", "live", "channel", "user", "c"].includes(first.toLowerCase())) {
      return `https://www.youtube.com/${first}`;
    }
    return "";
  } catch {
    return "";
  }
}

function extractSocialLinks(html, website) {
  const links = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => absolutize(match[1], website))
    .filter(Boolean);

  const firstNormalized = (normalizer) => {
    for (const link of links) {
      const normalized = normalizer(link);
      if (normalized) return normalized;
    }
    return "";
  };

  return {
    facebook: firstNormalized(normalizeFacebookUrl),
    instagram: firstNormalized(normalizeInstagramUrl),
    youtube: firstNormalized(normalizeYouTubeUrl),
  };
}

async function resolveYouTubeChannelId(youtubeUrl) {
  const verifyCandidate = async (candidate) => {
    if (!candidate) return "";
    if (!process.env.YOUTUBE_API_KEY) return candidate;
    try {
      const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&id=${encodeURIComponent(candidate)}&key=${process.env.YOUTUBE_API_KEY}`);
      if (!response.ok) return "";
      const json = await response.json();
      return json.items?.[0]?.id || "";
    } catch {
      return "";
    }
  };

  const directId = await verifyCandidate(extractDirectYouTubeChannelId(youtubeUrl));
  if (directId) return directId;

  if (!youtubeUrl) return "";

  const html = await fetchHtml(youtubeUrl, 12000);
  if (html) {
    const patterns = [
      /"channelId":"(UC[A-Za-z0-9_-]{20,})"/,
      /<meta[^>]+itemprop=["']channelId["'][^>]+content=["'](UC[A-Za-z0-9_-]{20,})["']/i,
      /https:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{20,})/i,
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      const verified = await verifyCandidate(match?.[1] || "");
      if (verified) return verified;
    }
  }

  if (!process.env.YOUTUBE_API_KEY) return "";

  try {
    const parsed = new URL(youtubeUrl);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts[0]?.startsWith("@")) {
      const handle = parts[0].slice(1);
      if (!handle) return "";
      const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${process.env.YOUTUBE_API_KEY}`);
      if (!response.ok) return "";
      const json = await response.json();
      return await verifyCandidate(json.items?.[0]?.id || "");
    }

    if (parts[0] === "user" && parts[1]) {
      const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=${encodeURIComponent(parts[1])}&key=${process.env.YOUTUBE_API_KEY}`);
      if (!response.ok) return "";
      const json = await response.json();
      return await verifyCandidate(json.items?.[0]?.id || "");
    }
  } catch {
    return "";
  }

  return "";
}

async function loadChurches(supabase, region, reasonPrefix, statuses) {
  const rows = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from("churches")
      .select("slug,name,website,country,status,reason,youtube_channel_id")
      .range(from, from + PAGE_SIZE - 1);

    if (statuses.length === 1) query = query.eq("status", statuses[0]);
    else query = query.in("status", statuses);

    const { data, error } = await query;

    if (error) throw new Error(`Failed to load churches: ${error.message}`);
    rows.push(...(data || []).filter((row) => matchesRegion(row.country, region) && (!reasonPrefix || String(row.reason || "").startsWith(reasonPrefix))));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

async function loadEnrichments(supabase, slugs) {
  const map = new Map();
  for (let index = 0; index < slugs.length; index += 200) {
    const batch = slugs.slice(index, index + 200);
    const { data, error } = await supabase
      .from("church_enrichments")
      .select("church_slug,website_url,contact_email,facebook_url,instagram_url,youtube_url,cover_image_url")
      .in("church_slug", batch);
    if (error) throw new Error(`Failed to load enrichments: ${error.message}`);
    for (const row of data || []) map.set(row.church_slug, row);
  }
  return map;
}

async function main() {
  loadLocalEnv(ROOT_DIR);
  const options = parseArgs(process.argv.slice(2));
  const statuses = String(options.status || "pending")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const { createAdminClient, hasSupabaseServiceConfig } = supabaseCompat;

  if (!hasSupabaseServiceConfig()) {
    throw new Error("Missing DATABASE_URL or DATABASE_URL_UNPOOLED");
  }

  const supabase = createAdminClient();

  const allChurches = await loadChurches(supabase, options.region, options.reasonPrefix, statuses);
  const enrichmentMap = await loadEnrichments(supabase, allChurches.map((church) => church.slug));
  const candidates = allChurches.filter((church) => {
    const enrichment = enrichmentMap.get(church.slug);
    const hasEmail = Boolean(enrichment?.contact_email);
    const hasFacebook = Boolean(enrichment?.facebook_url);
    const hasInstagram = Boolean(enrichment?.instagram_url);
    const hasYoutube = Boolean(enrichment?.youtube_url);
    const needsChannelId = Boolean(enrichment?.youtube_url) && !church.youtube_channel_id;
    return !hasEmail || !hasFacebook || !hasInstagram || !hasYoutube || needsChannelId;
  });
  const churches = options.limit > 0 ? candidates.slice(0, options.limit) : candidates;
  const candidateMap = new Map(churches.map((church) => [church.slug, church]));
  const filteredEnrichmentMap = new Map([...enrichmentMap.entries()].filter(([slug]) => candidateMap.has(slug)));

  console.log(`Fallback website enrichment candidates: ${churches.length}`);

  const results = await mapWithConcurrency(churches, options.concurrency, async (church) => {
    const enrichment = filteredEnrichmentMap.get(church.slug);
    const website = church.website || enrichment?.website_url || "";
    const youtubeUrl = enrichment?.youtube_url || "";
    const needsChannelId = Boolean(youtubeUrl) && !church.youtube_channel_id;

    if (!website && !needsChannelId) {
      return { slug: church.slug, updated: false, reason: "missing_website" };
    }

    const html = website ? await fetchHtml(website) : "";
    const email = enrichment?.contact_email || extractEmailsFromHtml(html, normalizeHost(website))[0] || "";
    const social = html ? extractSocialLinks(html, website) : { facebook: "", instagram: "", youtube: "" };
    const resolvedYoutubeUrl = normalizeYouTubeUrl(enrichment?.youtube_url || "") || social.youtube || "";
    const youtubeChannelId = !church.youtube_channel_id && resolvedYoutubeUrl
      ? await resolveYouTubeChannelId(resolvedYoutubeUrl)
      : "";

    const update = {
      church_slug: church.slug,
      ...(enrichment?.website_url || website ? { website_url: enrichment?.website_url || website } : {}),
      ...(email ? { contact_email: email } : {}),
      ...(enrichment?.facebook_url || social.facebook ? { facebook_url: enrichment?.facebook_url || social.facebook } : {}),
      ...(enrichment?.instagram_url || social.instagram ? { instagram_url: enrichment?.instagram_url || social.instagram } : {}),
      ...(resolvedYoutubeUrl ? { youtube_url: resolvedYoutubeUrl } : {}),
    };

    const changedFields = Object.keys(update).filter((key) => key !== "church_slug" && (!enrichment || enrichment[key] !== update[key]));
    let churchUpdated = false;
    if (changedFields.length === 0) {
      if (!youtubeChannelId) {
        return { slug: church.slug, updated: false, reason: "no_new_fields" };
      }
    }

    if (!options.preview) {
      if (changedFields.length > 0) {
        const { error } = await supabase
          .from("church_enrichments")
          .upsert(update, { onConflict: "church_slug" });
        if (error) {
          throw new Error(`Failed to update enrichment for ${church.slug}: ${error.message}`);
        }
      }

      if (youtubeChannelId) {
        const { error } = await supabase
          .from("churches")
          .update({ youtube_channel_id: youtubeChannelId })
          .eq("slug", church.slug)
          .is("youtube_channel_id", null);
        if (error) {
          throw new Error(`Failed to update YouTube channel for ${church.slug}: ${error.message}`);
        }
        churchUpdated = true;
      }
    }

    return {
      slug: church.slug,
      updated: changedFields.length > 0 || churchUpdated || Boolean(youtubeChannelId),
      fields: changedFields,
      email: email || "",
      facebook: update.facebook_url || "",
      instagram: update.instagram_url || "",
      youtube: update.youtube_url || "",
      youtubeChannelId,
      domain: normalizeHost(website),
    };
  });

  const updated = results.filter((result) => result.ok && result.value?.updated).map((result) => result.value);
  const emailCount = updated.filter((row) => row.email).length;
  const facebookCount = updated.filter((row) => row.facebook).length;
  const instagramCount = updated.filter((row) => row.instagram).length;
  const youtubeCount = updated.filter((row) => row.youtube).length;
  const youtubeChannelCount = updated.filter((row) => row.youtubeChannelId).length;

  console.log(`Updated: ${updated.length}`);
  console.log(`Emails added or kept: ${emailCount}`);
  console.log(`Facebook added or kept: ${facebookCount}`);
  console.log(`Instagram added or kept: ${instagramCount}`);
  console.log(`YouTube added or kept: ${youtubeCount}`);
  console.log(`YouTube channel IDs added or kept: ${youtubeChannelCount}`);
  console.log(JSON.stringify(updated.slice(0, 20), null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
