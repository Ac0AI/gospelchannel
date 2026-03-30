import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { isAdminEmail } from "@/lib/auth";
import { getDb, hasDatabaseConfig, schema } from "@/db";

type ProxyUser = {
  email: string;
};

function buildLoginRedirect(request: NextRequest, loginPath: string) {
  const redirectPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const loginUrl = new URL(loginPath, request.url);
  loginUrl.searchParams.set("redirect", redirectPath);
  return NextResponse.redirect(loginUrl);
}

async function getAuthenticatedUserFromRequest(request: NextRequest): Promise<ProxyUser | null> {
  if (!hasDatabaseConfig()) {
    return null;
  }

  try {
    const signedToken =
      request.cookies.get("__Secure-better-auth.session_token")?.value
      ?? request.cookies.get("better-auth.session_token")?.value;
    const token = signedToken?.split(".")[0];
    if (!token) {
      return null;
    }

    const db = getDb();
    const rows = await db
      .select({
        email: schema.user.email,
      })
      .from(schema.session)
      .innerJoin(schema.user, eq(schema.session.userId, schema.user.id))
      .where(and(eq(schema.session.token, token), gt(schema.session.expiresAt, new Date())))
      .limit(1);

    if (!rows[0]?.email) {
      return null;
    }

    return { email: rows[0].email };
  } catch {
    return null;
  }
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const user = await getAuthenticatedUserFromRequest(request);

  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") {
      if (user && isAdminEmail(user.email)) {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
      return NextResponse.next();
    }

    if (!user) {
      return buildLoginRedirect(request, "/admin/login");
    }

    if (!isAdminEmail(user.email)) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  if (pathname.startsWith("/church-admin")) {
    if (pathname === "/church-admin/login") {
      if (user) {
        const redirectTo = request.nextUrl.searchParams.get("redirect") || "/church-admin";
        return NextResponse.redirect(new URL(redirectTo, request.url));
      }
      return NextResponse.next();
    }

    if (!user) {
      return buildLoginRedirect(request, "/church-admin/login");
    }
  }

  return NextResponse.next();
}
