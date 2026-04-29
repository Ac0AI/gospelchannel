import { NextResponse } from "next/server";
import { getEuropeanChurchTechReport } from "@/lib/european-church-tech-report";

export const revalidate = 3600;

export async function GET() {
  const report = await getEuropeanChurchTechReport();

  return NextResponse.json(report, {
    headers: {
      "cache-control": "public, max-age=300, s-maxage=3600",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET",
    },
  });
}
