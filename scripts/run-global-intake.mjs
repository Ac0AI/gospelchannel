#!/usr/bin/env node

import { spawn } from "node:child_process";

const providedArgs = process.argv.slice(2);

function hasFlag(prefix) {
  return providedArgs.some((arg) => arg === prefix || arg.startsWith(`${prefix}=`));
}

const discoverArgs = [
  ...(hasFlag("--countries") ? [] : ["--countries=all"]),
  ...(hasFlag("--daily-target") ? [] : ["--daily-target=1000"]),
  ...providedArgs,
];

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? "unknown"}`));
    });

    child.on("error", reject);
  });
}

async function main() {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

  await run(npmCommand, ["run", "discover:global", "--", ...discoverArgs]);
  await run(npmCommand, ["run", "screen:candidates"]);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
