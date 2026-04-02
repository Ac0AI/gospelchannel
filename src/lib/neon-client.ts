import { randomUUID } from "node:crypto";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq, sql as drizzleSql } from "drizzle-orm";
import { getDb, getSql, hasDatabaseConfig, schema } from "@/db";
import { ensureAuthUser, ensurePasswordAccount, getServerUser, hasBetterAuthConfig } from "@/lib/auth/server";

type QueryError = { message: string };
type QueryResult<T = unknown> = {
  data: T | null;
  error: QueryError | null;
  count?: number | null;
};

type FilterOp =
  | { kind: "eq"; column: string; value: unknown }
  | { kind: "neq"; column: string; value: unknown }
  | { kind: "ilike"; column: string; value: unknown }
  | { kind: "in"; column: string; value: unknown[] }
  | { kind: "gte"; column: string; value: unknown }
  | { kind: "lte"; column: string; value: unknown }
  | { kind: "not"; column: string; operator: string; value: unknown };

type OrderOp = {
  column: string;
  ascending: boolean;
};

const TABLE_NAMES = new Set([
  "churches",
  "church_suggestions",
  "church_feedback",
  "church_claims",
  "church_candidates",
  "church_candidate_playlist_reviews",
  "church_memberships",
  "church_enrichments",
  "church_networks",
  "church_campuses",
  "church_profile_edits",
  "church_outreach",
  "church_playlist_reviews",
  "church_followers",
  "prayers",
  "church_update_sources",
  "church_update_items",
  "church_website_tech",
  "church_vote_totals",
  "church_vote_events",
  "video_moved_totals",
  "video_moved_events",
  "app_rate_limits",
  "user",
  "session",
  "account",
  "verification",
]);

function normalizeQueryError(error: unknown): QueryError {
  if (error instanceof Error) {
    return { message: error.message };
  }
  return { message: "Unknown database error" };
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

function ensureTableName(name: string): string {
  if (!TABLE_NAMES.has(name)) {
    throw new Error(`Unsupported table: ${name}`);
  }
  return quoteIdentifier(name);
}

function buildSelectClause(columns: string): string {
  const normalized = columns.trim();
  if (!normalized || normalized === "*") {
    return "*";
  }

  if (normalized.includes("(")) {
    throw new Error(`Nested selects are not supported by the Neon compatibility layer: ${columns}`);
  }

  return normalized
    .split(",")
    .map((column) => quoteIdentifier(column.trim()))
    .join(", ");
}

function buildWhereClause(filters: FilterOp[]) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  for (const filter of filters) {
    const column = quoteIdentifier(filter.column);

    if (filter.kind === "not") {
      if (filter.operator === "is" && filter.value === null) {
        conditions.push(`${column} IS NOT NULL`);
        continue;
      }
      throw new Error(`Unsupported .not() operator: ${filter.operator}`);
    }

    if (filter.kind === "in") {
      params.push(filter.value);
      conditions.push(`${column} = ANY($${params.length})`);
      continue;
    }

    params.push(filter.value);
    const placeholder = `$${params.length}`;

    switch (filter.kind) {
      case "eq":
        if (filter.value === null) {
          conditions.push(`${column} IS NULL`);
          params.pop();
        } else {
          conditions.push(`${column} = ${placeholder}`);
        }
        break;
      case "neq":
        if (filter.value === null) {
          conditions.push(`${column} IS NOT NULL`);
          params.pop();
        } else {
          conditions.push(`${column} <> ${placeholder}`);
        }
        break;
      case "ilike":
        conditions.push(`${column} ILIKE ${placeholder}`);
        break;
      case "gte":
        conditions.push(`${column} >= ${placeholder}`);
        break;
      case "lte":
        conditions.push(`${column} <= ${placeholder}`);
        break;
    }
  }

  return {
    clause: conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

class NeonTableQuery<T = unknown>
  implements PromiseLike<QueryResult<T>>
{
  private action: "select" | "insert" | "update" | "upsert" = "select";
  private selectColumns = "*";
  private selectCalled = false;
  private selectOptions: { count?: "exact"; head?: boolean } | undefined;
  private filters: FilterOp[] = [];
  private orders: OrderOp[] = [];
  private rangeValue: { from: number; to: number } | undefined;
  private limitValue: number | undefined;
  private payload: Record<string, unknown> | Array<Record<string, unknown>> | undefined;
  private onConflict: string[] = [];

  constructor(private readonly tableName: string) {}

  select(columns = "*", options?: { count?: "exact"; head?: boolean }) {
    this.selectColumns = columns;
    this.selectCalled = true;
    this.selectOptions = options;
    return this;
  }

  insert(values: Record<string, unknown> | Array<Record<string, unknown>>) {
    this.action = "insert";
    this.payload = values;
    return this;
  }

  update(values: Record<string, unknown>) {
    this.action = "update";
    this.payload = values;
    return this;
  }

  upsert(values: Record<string, unknown> | Array<Record<string, unknown>>, options?: { onConflict?: string }) {
    this.action = "upsert";
    this.payload = values;
    this.onConflict = options?.onConflict?.split(",").map((value) => value.trim()).filter(Boolean) ?? [];
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ kind: "eq", column, value });
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push({ kind: "neq", column, value });
    return this;
  }

  ilike(column: string, value: unknown) {
    this.filters.push({ kind: "ilike", column, value });
    return this;
  }

  in(column: string, value: unknown[]) {
    this.filters.push({ kind: "in", column, value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push({ kind: "gte", column, value });
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push({ kind: "lte", column, value });
    return this;
  }

  not(column: string, operator: string, value: unknown) {
    this.filters.push({ kind: "not", column, operator, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orders.push({
      column,
      ascending: options?.ascending ?? true,
    });
    return this;
  }

  range(from: number, to: number) {
    this.rangeValue = { from, to };
    return this;
  }

  limit(limit: number) {
    this.limitValue = limit;
    return this;
  }

  async single(): Promise<QueryResult<T>> {
    const result = await this.execute();
    const rows = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
    if (rows.length !== 1) {
      return { data: null, error: { message: "Expected exactly one row" } };
    }
    return { ...result, data: rows[0] as T };
  }

  async maybeSingle(): Promise<QueryResult<T>> {
    const result = await this.execute();
    const rows = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
    if (rows.length === 0) {
      return { ...result, data: null, error: null };
    }
    return { ...result, data: rows[0] as T };
  }

  then<TResult1 = QueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<QueryResult<T>> {
    try {
      switch (this.action) {
        case "insert":
          return await this.executeInsert();
        case "update":
          return await this.executeUpdate();
        case "upsert":
          return await this.executeUpsert();
        default:
          return await this.executeSelect();
      }
    } catch (error) {
      return {
        data: null,
        error: normalizeQueryError(error),
      };
    }
  }

  private async executeSelect(): Promise<QueryResult<T>> {
    const table = ensureTableName(this.tableName);
    const { clause, params } = buildWhereClause(this.filters);

    if (this.selectOptions?.count === "exact" && this.selectOptions.head) {
      const countRows = await getSql().query(
        `SELECT COUNT(*)::int AS count FROM ${table}${clause}`,
        params,
      ) as Array<{ count: number }>;

      return {
        data: null,
        error: null,
        count: Number(countRows[0]?.count ?? 0),
      };
    }

    const orderClause = this.orders.length
      ? ` ORDER BY ${this.orders.map((order) => `${quoteIdentifier(order.column)} ${order.ascending ? "ASC" : "DESC"}`).join(", ")}`
      : "";

    const limit = this.rangeValue
      ? this.rangeValue.to - this.rangeValue.from + 1
      : this.limitValue;
    const offset = this.rangeValue?.from;

    const limitClause = typeof limit === "number" ? ` LIMIT ${limit}` : "";
    const offsetClause = typeof offset === "number" ? ` OFFSET ${offset}` : "";

    const rows = await getSql().query(
      `SELECT ${buildSelectClause(this.selectColumns)} FROM ${table}${clause}${orderClause}${limitClause}${offsetClause}`,
      params,
    ) as T;

    return {
      data: rows as T,
      error: null,
    };
  }

  private async executeInsert(): Promise<QueryResult<T>> {
    const rows = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
    if (rows.length === 0) {
      return { data: null, error: null };
    }

    const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    const table = ensureTableName(this.tableName);
    const params: unknown[] = [];
    const valuesClause = rows
      .map((row) => {
        const placeholders = columns.map((column) => {
          params.push(row[column] ?? null);
          return `$${params.length}`;
        });
        return `(${placeholders.join(", ")})`;
      })
      .join(", ");

    const returningClause = this.selectCalled ? ` RETURNING ${buildSelectClause(this.selectColumns)}` : "";
    const query = `INSERT INTO ${table} (${columns.map(quoteIdentifier).join(", ")}) VALUES ${valuesClause}${returningClause}`;
    const result = await getSql().query(query, params) as T;
    return { data: returningClause ? (result as T) : null, error: null };
  }

  private async executeUpdate(): Promise<QueryResult<T>> {
    const table = ensureTableName(this.tableName);
    const values = this.payload as Record<string, unknown>;
    const setKeys = Object.keys(values ?? {});
    if (setKeys.length === 0) {
      return { data: null, error: null };
    }

    const params: unknown[] = [];
    const setClause = setKeys
      .map((key) => {
        params.push(values[key] ?? null);
        return `${quoteIdentifier(key)} = $${params.length}`;
      })
      .join(", ");

    const where = buildWhereClause(this.filters);
    const queryParams = [...params, ...where.params];
    const whereClause = where.clause
      ? ` WHERE ${where.clause.replace(/^ WHERE /, "").replace(/\$(\d+)/g, (_, n) => `$${Number(n) + params.length}`)}`
      : "";
    const returningClause = this.selectCalled ? ` RETURNING ${buildSelectClause(this.selectColumns)}` : "";
    const result = await getSql().query(`UPDATE ${table} SET ${setClause}${whereClause}${returningClause}`, queryParams) as T;

    return {
      data: returningClause ? (result as T) : null,
      error: null,
    };
  }

  private async executeUpsert(): Promise<QueryResult<T>> {
    const rows = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
    if (rows.length === 0) {
      return { data: null, error: null };
    }

    const table = ensureTableName(this.tableName);
    const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    const params: unknown[] = [];

    const valuesClause = rows
      .map((row) => {
        const placeholders = columns.map((column) => {
          params.push(row[column] ?? null);
          return `$${params.length}`;
        });
        return `(${placeholders.join(", ")})`;
      })
      .join(", ");

    const conflictColumns = this.onConflict.length > 0 ? this.onConflict : columns;
    const updateColumns = columns.filter((column) => !conflictColumns.includes(column));
    const updateClause = updateColumns.length > 0
      ? ` DO UPDATE SET ${updateColumns.map((column) => `${quoteIdentifier(column)} = EXCLUDED.${quoteIdentifier(column)}`).join(", ")}`
      : " DO NOTHING";
    const returningClause = this.selectCalled ? ` RETURNING ${buildSelectClause(this.selectColumns)}` : "";

    const query = [
      `INSERT INTO ${table} (${columns.map(quoteIdentifier).join(", ")})`,
      `VALUES ${valuesClause}`,
      `ON CONFLICT (${conflictColumns.map(quoteIdentifier).join(", ")})${updateClause}`,
      returningClause,
    ].join(" ");

    const result = await getSql().query(query, params) as T;
    return { data: returningClause ? (result as T) : null, error: null };
  }
}

async function uploadToR2(path: string, body: ArrayBuffer | Buffer, contentType?: string) {
  const context = await getCloudflareContext({ async: true });
  await context.env.CHURCH_ASSETS.put(path, body, {
    httpMetadata: contentType ? { contentType } : undefined,
  });
}

function buildPublicMediaUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL || "https://media.gospelchannel.com").replace(/\/$/, "");
  return `${base}/${path.replace(/^\//, "")}`;
}

function normalizeAuthError(error: unknown): { message: string } {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return { message: error.message };
  }
  return { message: "Authentication failed" };
}

async function authPost(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
  if (!response.ok) {
    return {
      data: null,
      error: { message: payload?.message || payload?.error || "Authentication failed" },
    };
  }

  return {
    data: payload,
    error: null,
  };
}

export function hasPublicConfig() {
  return hasBetterAuthConfig();
}

export function hasServiceConfig() {
  return hasDatabaseConfig();
}

export function createAdminClient() {
  return {
    from<T = unknown>(tableName: string) {
      return new NeonTableQuery<T>(tableName);
    },
    auth: {
      admin: {
        async listUsers(options?: { page?: number; perPage?: number }) {
          const page = Math.max(1, options?.page ?? 1);
          const perPage = Math.min(200, Math.max(1, options?.perPage ?? 50));
          const offset = (page - 1) * perPage;
          const db = getDb();

          const users = await db
            .select()
            .from(schema.user)
            .orderBy(schema.user.createdAt)
            .limit(perPage)
            .offset(offset);

          return {
            data: { users },
            error: null,
          };
        },
        async createUser(input: {
          email: string;
          email_confirm?: boolean;
          password?: string;
          user_metadata?: { full_name?: string };
        }) {
          try {
            const user = await ensureAuthUser({
              email: input.email,
              name: input.user_metadata?.full_name || input.email,
              emailVerified: input.email_confirm ?? true,
              password: input.password,
            });
            return {
              data: { user },
              error: null,
            };
          } catch (error) {
            return {
              data: null,
              error: normalizeAuthError(error),
            };
          }
        },
      },
    },
    storage: {
      from(bucket: string) {
        return {
          async upload(
            path: string,
            body: ArrayBuffer | Buffer,
            options?: { contentType?: string; upsert?: boolean },
          ) {
            if (bucket !== "church-assets") {
              return { error: { message: `Unsupported bucket: ${bucket}` } };
            }

            try {
              await uploadToR2(path, body, options?.contentType);
              return { error: null };
            } catch (error) {
              return { error: normalizeQueryError(error) };
            }
          },
          getPublicUrl(path: string) {
            return {
              data: {
                publicUrl: buildPublicMediaUrl(path),
              },
            };
          },
        };
      },
    },
    async rpc(name: string, params: Record<string, unknown>) {
      if (name !== "increment_prayed_count") {
        return { data: null, error: { message: `Unsupported RPC: ${name}` } };
      }

      try {
        const db = getDb();
        const prayerId = String(params.prayer_id || "");
        const rows = await db
          .update(schema.prayers)
          .set({
            prayedCount: drizzleSql`${schema.prayers.prayedCount} + 1`,
          })
          .where(eq(schema.prayers.id, prayerId))
          .returning({ prayedCount: schema.prayers.prayedCount });

        return {
          data: rows[0]?.prayedCount ?? 0,
          error: null,
        };
      } catch (error) {
        return {
          data: null,
          error: normalizeQueryError(error),
        };
      }
    },
  };
}

export function createPublicClient() {
  return createAdminClient();
}

export function createBrowserClient() {
  return {
    auth: {
      async signInWithPassword(input: { email: string; password: string }) {
        const result = await authPost("/api/auth/sign-in/email", input);
        return {
          data: result.data,
          error: result.error,
        };
      },
      async signInWithOtp(input: { email: string; options?: { shouldCreateUser?: boolean } }) {
        const result = await authPost("/api/auth/email-otp/send-verification-otp", {
          email: input.email,
          type: "sign-in",
        });
        return {
          data: result.data,
          error: result.error,
        };
      },
      async verifyOtp(input: { email: string; token: string; type?: string }) {
        const result = await authPost("/api/auth/sign-in/email-otp", {
          email: input.email,
          otp: input.token,
        });
        return {
          data: result.data,
          error: result.error,
        };
      },
      async signOut() {
        const result = await authPost("/api/auth/sign-out", {});
        return {
          error: result.error,
        };
      },
    },
  };
}

export async function getAuthenticatedUserFromHeaders(headersInit: HeadersInit) {
  return getServerUser(headersInit);
}

export async function seedAdminPassword(email: string, password: string) {
  const user = await ensureAuthUser({
    email,
    name: email,
    emailVerified: true,
  });
  await ensurePasswordAccount(user.id, password);
  return user;
}

export function createTemporaryUserId() {
  return randomUUID();
}
