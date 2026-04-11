import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { hashPassword } from "better-auth/crypto";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies, toNextJsHandler } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins/email-otp";
import { magicLink } from "better-auth/plugins/magic-link";
import { and, eq } from "drizzle-orm";
import { getDb, hasDatabaseConfig, schema } from "@/db";
import { USER_ROLE, type UserRole } from "@/lib/auth-roles";
import { sendAuthOtpEmail, sendChurchAdminMagicLinkEmail } from "@/lib/email";

function getTrustedOrigins(): string[] {
  const origins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (process.env.BETTER_AUTH_URL) {
    origins.push(process.env.BETTER_AUTH_URL);
  }

  if (process.env.NEXT_PUBLIC_SITE_URL) {
    origins.push(process.env.NEXT_PUBLIC_SITE_URL);
  }

  return [...new Set(origins)];
}

function getAllowedHosts(): string[] {
  return [...new Set(
    getTrustedOrigins()
      .map((origin) => {
        try {
          return new URL(origin).host;
        } catch {
          return null;
        }
      })
      .filter((value): value is string => Boolean(value)),
  )];
}

function getAuthBaseUrl() {
  const fallback = process.env.BETTER_AUTH_URL;
  const allowedHosts = getAllowedHosts();

  if (fallback && allowedHosts.length > 0) {
    return {
      fallback,
      allowedHosts,
    };
  }

  return fallback;
}

function ensureAuthConfig() {
  if (!process.env.BETTER_AUTH_SECRET) {
    throw new Error("Missing BETTER_AUTH_SECRET");
  }
  if (!process.env.BETTER_AUTH_URL) {
    throw new Error("Missing BETTER_AUTH_URL");
  }
  if (!hasDatabaseConfig()) {
    throw new Error("Missing DATABASE_URL");
  }
}

let authInstance: unknown = null;

function getAuth(): ReturnType<typeof betterAuth> {
  ensureAuthConfig();

  if (!authInstance) {
    authInstance = betterAuth({
      database: drizzleAdapter(getDb(), {
        provider: "pg",
        schema,
        camelCase: true,
      }),
      secret: process.env.BETTER_AUTH_SECRET,
      baseURL: getAuthBaseUrl(),
      trustedOrigins: getTrustedOrigins(),
      plugins: [
        nextCookies(),
        emailOTP({
          disableSignUp: true,
          async sendVerificationOTP({ email, otp, type }) {
            if (type !== "sign-in") {
              return;
            }
            await sendAuthOtpEmail({ email, otp });
          },
        }),
        magicLink({
          disableSignUp: true,
          async sendMagicLink({ email, url }) {
            await sendChurchAdminMagicLinkEmail({ email, url });
          },
        }),
      ],
      emailAndPassword: {
        enabled: true,
        disableSignUp: true,
      },
    });
  }

  return authInstance as ReturnType<typeof betterAuth>;
}

const authRouteHandler = (request: Request, method: keyof ReturnType<typeof toNextJsHandler>) => {
  const handler = toNextJsHandler(getAuth());
  return handler[method](request);
};

export const authHandler = {
  GET(request: Request) {
    return authRouteHandler(request, "GET");
  },
  POST(request: Request) {
    return authRouteHandler(request, "POST");
  },
  PATCH(request: Request) {
    return authRouteHandler(request, "PATCH");
  },
  PUT(request: Request) {
    return authRouteHandler(request, "PUT");
  },
  DELETE(request: Request) {
    return authRouteHandler(request, "DELETE");
  },
};

export type AuthSession = {
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
    token: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  };
  user: {
    id: string;
    email: string;
    emailVerified: boolean;
    name: string;
    image?: string | null;
  };
};

export type AuthUser = AuthSession["user"];

export function hasBetterAuthConfig(): boolean {
  return Boolean(process.env.BETTER_AUTH_SECRET && process.env.BETTER_AUTH_URL && hasDatabaseConfig());
}

export async function getServerSession(headersInit: HeadersInit): Promise<AuthSession | null> {
  if (!hasBetterAuthConfig()) {
    return null;
  }

  return getAuth().api.getSession({
    headers: new Headers(headersInit),
  });
}

export async function getServerUser(headersInit: HeadersInit): Promise<AuthUser | null> {
  const session = await getServerSession(headersInit);
  return session?.user ?? null;
}

export async function findAuthUserByEmail(email: string): Promise<AuthUser | null> {
  ensureAuthConfig();
  const db = getDb();
  const normalizedEmail = email.trim().toLowerCase();
  const rows = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, normalizedEmail))
    .limit(1);

  return rows[0] ?? null;
}

export async function createAuthUser(params: {
  email: string;
  name: string;
  emailVerified?: boolean;
  password?: string;
  role?: UserRole;
}): Promise<AuthUser> {
  ensureAuthConfig();
  const db = getDb();
  const now = new Date();
  const userId = randomUUID();

  const [newUser] = await db
    .insert(schema.user)
    .values({
      id: userId,
      email: params.email.trim().toLowerCase(),
      name: params.name.trim() || params.email.trim().toLowerCase(),
      role: params.role ?? USER_ROLE.USER,
      emailVerified: params.emailVerified ?? true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!newUser) {
    throw new Error("Failed to create auth user");
  }

  if (params.password) {
    const passwordHash = await hashPassword(params.password);
    await db.insert(schema.account).values({
      id: randomUUID(),
      accountId: newUser.id,
      providerId: "credential",
      userId: newUser.id,
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    });
  }

  return newUser;
}

export async function ensureAuthUser(params: {
  email: string;
  name: string;
  emailVerified?: boolean;
  password?: string;
  role?: UserRole;
}): Promise<AuthUser> {
  const existing = await findAuthUserByEmail(params.email);
  if (existing) {
    if (params.password) {
      await ensurePasswordAccount(existing.id, params.password);
    }
    if (params.role) {
      await ensureUserRole(existing.id, params.role);
    }
    return existing;
  }

  return createAuthUser(params);
}

export async function ensureUserRole(userId: string, role: UserRole): Promise<void> {
  ensureAuthConfig();
  await getDb()
    .update(schema.user)
    .set({
      role,
      updatedAt: new Date(),
    })
    .where(eq(schema.user.id, userId));
}

export async function ensurePasswordAccount(userId: string, password: string): Promise<void> {
  ensureAuthConfig();
  const db = getDb();
  const existing = await db
    .select()
    .from(schema.account)
    .where(and(eq(schema.account.userId, userId), eq(schema.account.providerId, "credential")))
    .limit(1);

  const passwordHash = await hashPassword(password);
  const now = new Date();

  if (existing[0]) {
    await db
      .update(schema.account)
      .set({
        password: passwordHash,
        updatedAt: now,
      })
      .where(eq(schema.account.id, existing[0].id));
    return;
  }

  await db.insert(schema.account).values({
    id: randomUUID(),
    accountId: userId,
    providerId: "credential",
    userId,
    password: passwordHash,
    createdAt: now,
    updatedAt: now,
  });
}
