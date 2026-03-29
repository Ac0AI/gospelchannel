import { NextRequest } from "next/server";
import { requireAdminRoute } from "@/lib/admin-route";
import { revalidatePublicChurchContent } from "@/lib/content";
import { updateStatus } from "@/lib/church-community";

const VALID_TABLES = new Set([
  "church_suggestions",
  "church_feedback",
  "church_claims",
  "churches",
]);

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

  if (!VALID_TABLES.has(payload.table)) {
    return admin.json({ error: "Invalid table" }, { status: 400 });
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
