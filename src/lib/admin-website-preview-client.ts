import { postAdminAction } from "@/lib/admin-client";
import type { WebsitePreview } from "@/lib/website-preview";

const previewCache = new Map<string, Promise<WebsitePreview>>();

export function loadWebsitePreview(websiteUrl: string): Promise<WebsitePreview> {
  const key = websiteUrl.trim();
  if (!key) {
    return Promise.reject(new Error("Missing website"));
  }

  const existing = previewCache.get(key);
  if (existing) return existing;

  const request = postAdminAction<{ website: string }, WebsitePreview>("/api/admin/candidates/metadata", {
    website: key,
  }).catch((error) => {
    previewCache.delete(key);
    throw error;
  });

  previewCache.set(key, request);
  return request;
}
