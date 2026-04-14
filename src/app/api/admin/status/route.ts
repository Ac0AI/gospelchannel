import { NextRequest } from "next/server";
import { requireAdminRoute } from "@/lib/admin-route";
import { revalidatePublicChurchContent } from "@/lib/content";
import { updateStatus } from "@/lib/church-community";

const VALID_STATUSES_BY_TABLE = {
  church_suggestions: new Set(["pending", "reviewed", "approved", "rejected"]),
  church_feedback: new Set(["pending", "reviewed", "applied", "rejected"]),
  church_claims: new Set(["pending", "verified", "rejected"]),
  churches: new Set(["pending", "approved", "rejected", "archived"]),
};

export async function POST(request: NextRequest) {
  const admin = await requireAdminRoute(request);
  if (!admin.ok) return admin.response;

  const payload = (await request.json().catch(() => null)) as {
    table?: string;
    id?: string;
    status?: string;
  } | null;

  if (!payload?.table || !payload?.id || !payload?.status) {
    return admin.json({ error: "Missing table, id, or status" }, { status: 400 });
  }

  const validStatuses = VALID_STATUSES_BY_TABLE[payload.table as keyof typeof VALID_STATUSES_BY_TABLE];

  if (!validStatuses) {
    return admin.json({ error: "Invalid table" }, { status: 400 });
  }

  if (!validStatuses.has(payload.status)) {
    return admin.json({ error: "Invalid status for table" }, { status: 400 });
  }

  try {
    await updateStatus(
      payload.table as "church_suggestions" | "church_feedback" | "church_claims" | "churches",
      payload.id,
      payload.status
    );
    if (payload.table === "churches") {
      revalidatePublicChurchContent();
    }
    return admin.json({ success: true });
  } catch (err) {
    return admin.json({ error: (err as Error).message }, { status: 500 });
  }
}
