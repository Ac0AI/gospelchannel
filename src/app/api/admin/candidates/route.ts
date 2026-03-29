import { NextRequest } from "next/server";
import { requireAdminRoute } from "@/lib/admin-route";
import { updateChurchDetails } from "@/lib/church-community";
import { revalidatePublicChurchContent } from "@/lib/content";

export async function POST(request: NextRequest) {
  const admin = await requireAdminRoute(request);
  if (!admin.ok) return admin.response;

  const payload = (await request.json().catch(() => null)) as {
    slug?: string;
    name?: string;
    website?: string;
    email?: string;
    location?: string;
    country?: string;
  } | null;

  if (!payload?.slug) {
    return admin.json({ error: "Missing church slug" }, { status: 400 });
  }

  const name = payload.name?.trim() ?? "";
  const website = payload.website?.trim() ?? "";
  const email = payload.email?.trim() ?? "";
  const location = payload.location?.trim() ?? "";
  const country = payload.country?.trim() ?? "";

  if (!name) {
    return admin.json({ error: "Church name is required" }, { status: 400 });
  }

  if (website && !/^https?:\/\//i.test(website)) {
    return admin.json({ error: "Website must start with http:// or https://" }, { status: 400 });
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return admin.json({ error: "Invalid email address" }, { status: 400 });
  }

  try {
    await updateChurchDetails(payload.slug, { name, website, email, location, country });
    revalidatePublicChurchContent();
    return admin.json({ success: true });
  } catch (err) {
    return admin.json({ error: (err as Error).message }, { status: 500 });
  }
}
