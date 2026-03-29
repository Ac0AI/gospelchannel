#!/usr/bin/env node

/**
 * Bulk-approve church candidates with confidence >= threshold (default 0.80).
 *
 * Usage:
 *   source .env.local && node scripts/bulk-approve-candidates.mjs [--threshold 0.80] [--dry-run]
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  console.error("Run: source .env.local && node scripts/bulk-approve-candidates.mjs");
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const thresholdIdx = args.indexOf("--threshold");
const threshold = thresholdIdx !== -1 ? parseFloat(args[thresholdIdx + 1]) : 0.80;

console.log(`Threshold: ${threshold} | Dry run: ${dryRun}\n`);

const supabase = createClient(url, key);

// Fetch all pending candidates with confidence >= threshold
const { data: candidates, error } = await supabase
  .from("church_candidates")
  .select("id, name, confidence, source, status")
  .eq("status", "pending")
  .gte("confidence", threshold)
  .order("confidence", { ascending: false });

if (error) {
  console.error("Failed to fetch candidates:", error.message);
  process.exit(1);
}

console.log(`Found ${candidates.length} pending candidates with confidence >= ${threshold}\n`);

if (candidates.length === 0) {
  console.log("Nothing to approve.");
  process.exit(0);
}

// Show what we'll approve
for (const c of candidates) {
  console.log(`  ${(c.confidence * 100).toFixed(0)}%  ${c.name}`);
}

if (dryRun) {
  console.log("\nDry run — no changes made.");
  process.exit(0);
}

// Bulk update
console.log(`\nApproving ${candidates.length} candidates...`);

const ids = candidates.map((c) => c.id);
const { error: updateError } = await supabase
  .from("church_candidates")
  .update({ status: "approved" })
  .in("id", ids);

if (updateError) {
  console.error("Update failed:", updateError.message);
  process.exit(1);
}

console.log(`Done! Approved ${candidates.length} candidates.`);
