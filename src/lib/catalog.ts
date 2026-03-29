import { unstable_cache } from "next/cache";
import type { CatalogVideo } from "@/types/gospel";
import { getStaffPicks } from "@/lib/content";
import { readJsonFile, writeJsonFile } from "@/lib/json-store";
import { uniqueBy } from "@/lib/utils";

const CATALOG_CACHE_FILE = "cache/video-catalog.json";

async function _getVideoCatalog(): Promise<CatalogVideo[]> {
  const base = [...getStaffPicks()];
  const persisted = await readJsonFile<CatalogVideo[]>(CATALOG_CACHE_FILE, []);
  return uniqueBy([...base, ...persisted], (item) => item.videoId);
}

export const getVideoCatalog = unstable_cache(
  _getVideoCatalog,
  ["video-catalog"],
  { revalidate: 3600, tags: ["video-catalog"] }
);

export async function getCatalogVideoById(videoId: string): Promise<CatalogVideo | undefined> {
  const catalog = await getVideoCatalog();
  return catalog.find((item) => item.videoId === videoId);
}

export async function upsertVideoCatalog(videos: CatalogVideo[]): Promise<void> {
  if (videos.length === 0) {
    return;
  }

  const current = await readJsonFile<CatalogVideo[]>(CATALOG_CACHE_FILE, []);
  const merged = uniqueBy([...videos, ...current], (item) => item.videoId);
  await writeJsonFile(CATALOG_CACHE_FILE, merged);
}

export async function getCatalogVideosByIds(ids: string[]): Promise<CatalogVideo[]> {
  const catalog = await getVideoCatalog();
  const byId = new Map(catalog.map((video) => [video.videoId, video]));

  return ids
    .map((id) => byId.get(id))
    .filter((item): item is CatalogVideo => Boolean(item));
}
