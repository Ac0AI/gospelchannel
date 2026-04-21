import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function loadLocalEnv(rootDir) {
  for (const filename of [".env.local", ".env"]) {
    const filePath = join(rootDir, filename);
    if (!existsSync(filePath)) continue;

    const source = readFileSync(filePath, "utf8");
    for (const line of source.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const separator = trimmed.indexOf("=");
      if (separator <= 0) continue;

      const key = trimmed.slice(0, separator).trim();
      if (process.env[key]) continue;

      let value = trimmed.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      process.env[key] = value;
    }
  }
}
