import { NextRequest } from "next/server";
import { requireAdminRoute } from "@/lib/admin-route";
import { upsertPlaylistReview } from "@/lib/church-community";

const VALID_STATUSES = new Set(["kept", "rejected"]);

export async function POST(request: NextRequest) {
  const admin = await requireAdminRoute(request);
  if (!admin.ok) return admin.response;

  const payload = (await request.json().catch(() => null)) as {
    churchSlug?: string;
    playlistId?: string;
    status?: "kept" | "rejected";
  } | null;

  if (!payload?.churchSlug || !payload?.playlistId || !payload?.status) {
    return admin.json({ error: "Missing churchSlug, playlistId, or status" }, { status: 400 });
  }

  if (!VALID_STATUSES.has(payload.status)) {
    return admin.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    await upsertPlaylistReview(payload.churchSlug, payload.playlistId, payload.status);
    return admin.json({ success: true });
  } catch (err) {
    return admin.json({ error: (err as Error).message }, { status: 500 });
  }
}
