import { NextResponse } from "next/server";
import { getWorshipByDenominationReport } from "@/lib/worship-by-denomination-report";

export const revalidate = 3600;

export async function GET() {
  return NextResponse.json(getWorshipByDenominationReport(), {
    headers: {
      "cache-control": "public, max-age=300, s-maxage=3600",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET",
    },
  });
}
