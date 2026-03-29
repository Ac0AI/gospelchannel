import { NextRequest } from "next/server";
import { requireAdminRoute } from "@/lib/admin-route";
import { fetchWebsitePreview } from "@/lib/website-preview";

export async function POST(request: NextRequest) {
  const admin = await requireAdminRoute(request);
  if (!admin.ok) return admin.response;

  const payload = (await request.json().catch(() => null)) as {
    website?: string;
  } | null;

  const website = payload?.website?.trim() ?? "";

  if (!website) {
    return admin.json({ error: "Missing website" }, { status: 400 });
  }

  if (!/^https?:\/\//i.test(website)) {
    return admin.json({ error: "Website must start with http:// or https://" }, { status: 400 });
  }

  try {
    const preview = await fetchWebsitePreview(website);
    return admin.json(preview);
  } catch (err) {
    return admin.json({ error: (err as Error).message || "Failed to load website metadata" }, { status: 500 });
  }
}
