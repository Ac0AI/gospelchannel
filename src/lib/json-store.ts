import { promises as fs } from "node:fs";
import path from "node:path";

function dataPath(relativePath: string): string {
  return path.join(process.cwd(), "src", "data", relativePath);
}

export async function readJsonFile<T>(relativePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(dataPath(relativePath), "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJsonFile(relativePath: string, data: unknown): Promise<boolean> {
  try {
    const target = dataPath(relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch {
    return false;
  }
}
