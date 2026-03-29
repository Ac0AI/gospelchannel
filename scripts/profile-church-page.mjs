#!/usr/bin/env node

import { performance } from "node:perf_hooks";

function parseArgs(argv) {
  const baseUrlArg = argv.find((arg) => arg.startsWith("--base-url="));
  return {
    baseUrl: baseUrlArg ? baseUrlArg.slice("--base-url=".length) : "http://127.0.0.1:3000",
    slugs: argv.filter((arg) => !arg.startsWith("--")),
  };
}

async function measure(url) {
  const started = performance.now();
  const response = await fetch(url, { redirect: "follow" });
  const html = await response.text();
  return {
    status: response.status,
    ms: Math.round((performance.now() - started) * 10) / 10,
    bytes: Buffer.byteLength(html, "utf8"),
  };
}

async function main() {
  const { baseUrl, slugs } = parseArgs(process.argv.slice(2));
  const targets = slugs.length > 0
    ? slugs
    : ["sos-church", "hillsong-berlin", "awakening-church-berlin", "bethel-music-kids"];

  for (const slug of targets) {
    const url = `${baseUrl.replace(/\/$/, "")}/church/${slug}`;
    const first = await measure(url);
    const second = await measure(url);
    console.log(JSON.stringify({
      slug,
      status: first.status,
      firstRequestMs: first.ms,
      secondRequestMs: second.ms,
      responseBytes: first.bytes,
    }, null, 2));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
