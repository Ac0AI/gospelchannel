#!/usr/bin/env node
/**
 * Generate simple SVG placeholder logos for churches that don't have one.
 * Each logo: circle with gradient + church initials.
 * Color palette derived from a hash of the church name for consistency.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CHURCHES_JSON = join(ROOT, "src", "data", "churches.json");
const LOGOS_DIR = join(ROOT, "public", "churches");

const PALETTES = [
  { from: "#f43f5e", to: "#ec4899" }, // rose → pink
  { from: "#8b5cf6", to: "#a855f7" }, // violet → purple
  { from: "#38bdf8", to: "#3b82f6" }, // sky → blue
  { from: "#f59e0b", to: "#f97316" }, // amber → orange
  { from: "#10b981", to: "#14b8a6" }, // emerald → teal
  { from: "#d946ef", to: "#ec4899" }, // fuchsia → pink
  { from: "#6366f1", to: "#8b5cf6" }, // indigo → violet
  { from: "#2dd4bf", to: "#22d3ee" }, // teal → cyan
  { from: "#fb7185", to: "#f43f5e" }, // rose light → rose
  { from: "#fb923c", to: "#ef4444" }, // orange → red
];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getInitials(name) {
  return name
    .split(/[\s-]+/)
    .filter((w) => w.length > 0 && w[0] === w[0].toUpperCase())
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
}

function generateSvg(name) {
  const hash = hashString(name);
  const palette = PALETTES[hash % PALETTES.length];
  const initials = getInitials(name);
  const gradientId = `g${hash % 1000}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${palette.from}"/>
      <stop offset="100%" stop-color="${palette.to}"/>
    </linearGradient>
  </defs>
  <rect width="200" height="200" rx="24" fill="url(#${gradientId})"/>
  <text x="100" y="108" text-anchor="middle" dominant-baseline="central"
    font-family="system-ui, -apple-system, sans-serif" font-size="64" font-weight="700"
    fill="white" fill-opacity="0.92">${initials}</text>
</svg>`;
}

// Main
const churches = JSON.parse(readFileSync(CHURCHES_JSON, "utf-8"));
let created = 0;
let skipped = 0;

for (const church of churches) {
  const logoPath = church.logo?.replace(/^\//, "");
  if (!logoPath) continue;

  const absPath = join(LOGOS_DIR, logoPath.replace(/^churches\//, ""));

  if (existsSync(absPath)) {
    skipped++;
    continue;
  }

  const svg = generateSvg(church.name);
  writeFileSync(absPath, svg, "utf-8");
  created++;
  console.log(`Created: ${logoPath} (${getInitials(church.name)})`);
}

console.log(`\nDone! Created ${created} logos, skipped ${skipped} existing.`);
