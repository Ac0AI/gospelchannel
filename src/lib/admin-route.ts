import { NextRequest, NextResponse } from "next/server";
import type { AuthUser } from "@/lib/auth/server";
import { getServerUser } from "@/lib/auth/server";
import { isAdminUser } from "@/lib/admin-users";

type AdminRouteSuccess = {
  ok: true;
  user: AuthUser;
  json: (body: unknown, init?: ResponseInit) => NextResponse;
  respond: (response: NextResponse) => NextResponse;
};

type AdminRouteFailure = {
  ok: false;
  response: NextResponse;
};

export async function requireAdminRoute(request: NextRequest): Promise<AdminRouteSuccess | AdminRouteFailure> {
  if (!process.env.BETTER_AUTH_URL || !process.env.BETTER_AUTH_SECRET) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Better Auth is not configured" }, { status: 500 }),
    };
  }

  const json = (body: unknown, init?: ResponseInit) => NextResponse.json(body, init);
  const respond = (response: NextResponse) => response;
  const user = await getServerUser(request.headers);

  if (!user) {
    return {
      ok: false,
      response: json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (!(await isAdminUser(user.id))) {
    return {
      ok: false,
      response: json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, user, json, respond };
}
