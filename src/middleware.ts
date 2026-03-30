import { updateSession } from "@/lib/auth-session/proxy";
import { type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ["/admin/:path*", "/church-admin/:path*"],
};
