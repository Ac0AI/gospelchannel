#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

const CHURCHES_PATH = "src/data/churches.json";
const CONTENT_UPDATED_AT = process.env.CONTENT_UPDATED_AT ?? "2026-02-27T00:00:00.000Z";

function extractPlaylistId(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  const uriMatch = trimmed.match(/^spotify:playlist:([a-zA-Z0-9]{22})$/);
  if (uriMatch) return uriMatch[1];
  const urlMatch = trimmed.match(/open\.spotify\.com\/playlist\/([a-zA-Z0-9]{22})/);
  if (urlMatch) return urlMatch[1];
  if (/^[a-zA-Z0-9]{22}$/.test(trimmed)) return trimmed;
  return null;
}

function uniquePlaylistIds(values) {
  const seen = new Set();
  const ids = [];
  for (const value of values) {
    const id = extractPlaylistId(value);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function daysSince(value) {
  const reference = new Date(CONTENT_UPDATED_AT).getTime();
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(reference) || Number.isNaN(timestamp)) return null;
  return Math.max(0, Math.floor((reference - timestamp) / (1000 * 60 * 60 * 24)));
}

function deriveMetrics(church) {
  const playlistCount = uniquePlaylistIds([
    ...(church.spotifyPlaylistIds || []),
    ...(church.additionalPlaylists || []),
  ]).length;
  const verifiedAt = church.verifiedAt || church.lastResearched || CONTENT_UPDATED_AT;
  const dataFlags = [];
  let score = 0;

  if (playlistCount > 0) score += 25;
  else dataFlags.push("missing_playlist");

  if ((church.description || "").trim().length >= 80) score += 20;
  else dataFlags.push("weak_description");

  if (church.logo) score += 15;
  else dataFlags.push("missing_logo");

  if (church.country && church.location) score += 15;
  else dataFlags.push("missing_location");

  if ((church.musicStyle || []).length > 0) score += 10;
  else dataFlags.push("missing_music_style");

  const ageDays = daysSince(verifiedAt);
  if (ageDays !== null && ageDays <= 90) score += 15;
  else if (ageDays !== null && ageDays <= 180) {
    score += 7;
    dataFlags.push("stale_verification");
  } else {
    dataFlags.push("stale_verification");
  }

  if (!church.email) dataFlags.push("missing_email");

  return {
    playlistCount,
    qualityScore: Math.min(100, Math.max(0, Math.round(score))),
    verifiedAt,
    dataFlags: Array.from(new Set(dataFlags)),
  };
}

function main() {
  const shouldWrite = process.argv.includes("--write");
  const churches = JSON.parse(readFileSync(CHURCHES_PATH, "utf-8"));

  const flagCounts = new Map();
  const scored = churches.map((church) => {
    const metrics = deriveMetrics(church);
    for (const flag of metrics.dataFlags) {
      flagCounts.set(flag, (flagCounts.get(flag) || 0) + 1);
    }
    return { ...church, ...metrics };
  });

  const sortedFlags = [...flagCounts.entries()].sort((a, b) => b[1] - a[1]);
  const avgScore = Math.round(
    scored.reduce((sum, church) => sum + (church.qualityScore || 0), 0) / Math.max(1, scored.length),
  );

  console.log(`Churches scored: ${scored.length}`);
  console.log(`Average quality score: ${avgScore}`);
  console.log("Top quality issues:");
  for (const [flag, count] of sortedFlags.slice(0, 8)) {
    console.log(`- ${flag}: ${count}`);
  }

  if (shouldWrite) {
    writeFileSync(CHURCHES_PATH, `${JSON.stringify(scored, null, 2)}\n`, "utf-8");
    console.log(`Updated ${CHURCHES_PATH} with quality fields.`);
  } else {
    console.log("Run with --write to persist playlistCount/qualityScore/verifiedAt/dataFlags.");
  }
}

main();
