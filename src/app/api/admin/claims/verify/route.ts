import { NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireAdminRoute } from "@/lib/admin-route";
import { verifyChurchClaim } from "@/lib/church-community";
import { getChurchBySlugAsync } from "@/lib/content";
import { sendClaimVerifiedEmail } from "@/lib/email";
import { revalidateChurchClaimStatus } from "@/lib/church";

export async function POST(request: NextRequest) {
  const admin = await requireAdminRoute(request);
  if (!admin.ok) return admin.response;

  const payload = (await request.json().catch(() => null)) as {
    id?: string;
  } | null;

  if (!payload?.id) {
    return admin.json({ error: "Missing claim id" }, { status: 400 });
  }

  try {
    const result = await verifyChurchClaim(payload.id);
    revalidateChurchClaimStatus();

    const church = await getChurchBySlugAsync(result.churchSlug);
    const { ctx } = await getCloudflareContext({ async: true });
    ctx.waitUntil(
      sendClaimVerifiedEmail({
        to: result.email,
        churchName: church?.name || result.churchSlug,
        churchSlug: result.churchSlug,
      }).catch((err) => console.error("[verify] Failed to send notification email:", err)),
    );

    return admin.json({ success: true });
  } catch (err) {
    console.error("[verify] Failed to verify claim:", {
      claimId: payload.id,
      error: err,
    });
    return admin.json({ error: (err as Error).message }, { status: 500 });
  }
}
