import { NextRequest, NextResponse } from "next/server";
import { requireAdminRoute } from "@/lib/admin-route";
import {
  buildChurchWebsiteTechCsv,
  filterChurchWebsiteTechRecords,
  loadChurchWebsiteTechRecords,
  parseChurchWebsiteTechFilters,
} from "@/lib/church-website-tech";

export async function GET(request: NextRequest) {
  const admin = await requireAdminRoute(request);
  if (!admin.ok) return admin.response;

  try {
    const filters = parseChurchWebsiteTechFilters(request.nextUrl.searchParams);
    const records = await loadChurchWebsiteTechRecords();
    const filtered = filterChurchWebsiteTechRecords(records, filters);
    const csv = buildChurchWebsiteTechCsv(filtered);
    const dateStamp = new Date().toISOString().slice(0, 10);

    return admin.respond(new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="church-website-tech-${dateStamp}.csv"`,
        "Cache-Control": "no-store",
      },
    }));
  } catch (error) {
    return admin.json({ error: (error as Error).message || "Failed to export website tech CSV" }, { status: 500 });
  }
}
