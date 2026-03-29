#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const ROOT = resolve(process.cwd());
const STATE_PATH = resolve(ROOT, "tmp", "spreadsheets", "sweden-harvest-loop-state.json");

function parseArg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1 || index + 1 >= process.argv.length) return fallback;
  return process.argv[index + 1];
}

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function runCommand(command, args) {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      env: process.env,
      stdio: "inherit",
    });
    child.on("close", (code) => resolveRun(code ?? 1));
    child.on("error", () => resolveRun(1));
  });
}

async function runCycle(cycleNumber) {
  console.log(`\n[loop] Cycle ${cycleNumber} started at ${new Date().toISOString()}`);

  const discoverCode = await runCommand("node", ["scripts/discover-sweden-church-playlists.mjs"]);
  const exportCode = await runCommand("tmp/spreadsheets/.venv/bin/python", [
    "scripts/export-sweden-church-playlists.py",
  ]);

  const state = {
    cycle: cycleNumber,
    ranAt: new Date().toISOString(),
    discoverExitCode: discoverCode,
    exportExitCode: exportCode,
  };
  mkdirSync(resolve(ROOT, "tmp", "spreadsheets"), { recursive: true });
  writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);

  if (discoverCode !== 0 || exportCode !== 0) {
    console.warn(`[loop] Cycle ${cycleNumber} completed with failures`, state);
  } else {
    console.log(`[loop] Cycle ${cycleNumber} completed successfully`);
  }
}

async function main() {
  const intervalMinutes = toPositiveInt(
    parseArg("--interval-minutes", process.env.HARVEST_INTERVAL_MINUTES ?? "180"),
    180
  );
  const maxCycles = toPositiveInt(
    parseArg("--max-cycles", process.env.HARVEST_MAX_CYCLES ?? "0"),
    0
  );

  let cycle = 1;
  while (true) {
    await runCycle(cycle);

    if (maxCycles > 0 && cycle >= maxCycles) {
      console.log(`[loop] Stopped after ${cycle} cycles`);
      break;
    }

    cycle += 1;
    const waitMs = intervalMinutes * 60 * 1000;
    console.log(`[loop] Waiting ${intervalMinutes} minutes...`);
    await sleep(waitMs);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
