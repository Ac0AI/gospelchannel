import { readFileSync, writeFileSync } from "node:fs";

const data = JSON.parse(readFileSync("/tmp/llm-audit-results.json", "utf8"));
const flagged = data.flagged;

// Haiku sometimes flags but labels category=church — treat those as false positives
const real = flagged.filter((f) => f.category !== "church");

const byCat = {};
for (const f of real) {
  byCat[f.category] = byCat[f.category] || [];
  byCat[f.category].push(f);
}

// Sort each category by confidence
for (const cat of Object.keys(byCat)) {
  byCat[cat].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
}

console.log(`Total flagged: ${flagged.length}`);
console.log(`Real flags (excluding category=church false positives): ${real.length}`);
console.log(`False positives: ${flagged.length - real.length}\n`);

for (const [cat, items] of Object.entries(byCat).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n── ${cat.toUpperCase()} (${items.length}) ──`);
  for (const f of items) {
    console.log(`  [${(f.confidence || 0).toFixed(2)}] ${f.name} (${f.country})`);
    console.log(`    ${f.slug}`);
    console.log(`    ${f.reason}`);
  }
}

// Write slugs to delete list
const deleteSlugs = real
  .filter((f) => (f.confidence || 0) >= 0.8)
  .map((f) => ({ slug: f.slug, name: f.name, category: f.category, confidence: f.confidence, reason: f.reason }));

writeFileSync("/tmp/llm-audit-delete-candidates.json", JSON.stringify(deleteSlugs, null, 2));
console.log(`\nHigh-confidence (>=0.8) delete candidates: ${deleteSlugs.length}`);
console.log(`Written → /tmp/llm-audit-delete-candidates.json`);
