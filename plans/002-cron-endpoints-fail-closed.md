# Plan 002: Make the cron endpoints fail closed when CRON_SECRET is missing

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3e4c0127..HEAD -- src/app/api/cron/push-indexing/route.ts src/app/api/cron/sync/route.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW (code) — but see the deploy gate in Maintenance notes
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `3e4c0127`, 2026-06-12

## Why this matters

Both cron endpoints (`/api/cron/push-indexing` and `/api/cron/sync`) authorize requests with "if no secret is configured, allow everyone". At planning time, `wrangler secret list` for the production Worker showed CRON_SECRET is NOT set — so both endpoints are publicly triggerable today. An outsider can burn the site's Google Indexing API quota or force expensive church-update refreshes. Both endpoints also accept the secret as a `?secret=` query parameter, which leaks into access logs and cache keys. The fix: deny when unconfigured, and accept the secret only via the Authorization header (which is exactly how the Worker's scheduled handler sends it — `worker.ts:275-276`).

## Current state

- `src/app/api/cron/push-indexing/route.ts:14-20` — the fail-open authorizer:

```ts
function authorized(request: NextRequest): boolean {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) return true;
  const bearer = request.headers.get("authorization")?.replace("Bearer ", "");
  const query = request.nextUrl.searchParams.get("secret");
  return bearer === configuredSecret || query === configuredSecret;
}
```

- `src/app/api/cron/sync/route.ts:6-15` — same pattern, formatted across more lines (`if (!configuredSecret) { return true; }`).
- `worker.ts:275-276` — the scheduled (cron) handler that calls these routes internally:

```ts
  if (env.CRON_SECRET) {
    headers.set("authorization", `Bearer ${env.CRON_SECRET}`);
  }
```

So the internal caller already uses the Bearer header; nothing in the repo uses the `?secret=` query form (verified with `grep -rn "secret=" src/ scripts/ worker.ts` at planning time — no callers).

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `pnpm install`           | exit 0              |
| Typecheck | `pnpm exec tsc --noEmit` | exit 0, no output   |
| Tests     | `pnpm exec vitest run`   | all pass            |
| Lint      | `pnpm lint`              | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `src/app/api/cron/push-indexing/route.ts`
- `src/app/api/cron/sync/route.ts`

**Out of scope** (do NOT touch):
- `worker.ts` — the caller is already correct.
- `wrangler.jsonc` — cron schedule stays as is.
- Setting the actual CRON_SECRET value — that is a production action for the operator (see Maintenance notes), never something to commit.

## Git workflow

- Branch: `advisor/002-cron-fail-closed`
- Commit message style: conventional commits, e.g. `fix(security): cron endpoints fail closed without CRON_SECRET`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Fail closed and drop the query-param path in push-indexing

In `src/app/api/cron/push-indexing/route.ts`, replace the `authorized` function with:

```ts
function authorized(request: NextRequest): boolean {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) return false;
  const bearer = request.headers.get("authorization")?.replace("Bearer ", "");
  return bearer === configuredSecret;
}
```

**Verify**: `pnpm exec tsc --noEmit` → exit 0.

### Step 2: Same change in sync

In `src/app/api/cron/sync/route.ts`, apply the same transformation to its `authorized` function (keep that file's existing multi-line formatting style).

**Verify**: `grep -n "return true" src/app/api/cron/sync/route.ts src/app/api/cron/push-indexing/route.ts` → no match inside either `authorized` function.

### Step 3: Confirm nothing else breaks

**Verify**: `pnpm exec vitest run` → all pass. `pnpm lint` → exit 0.

## Test plan

No new tests: the `authorized` helpers are module-private and the behavior change is two lines per file. The done criteria below are the regression gate. (If a reviewer wants tests, exporting `authorized` purely for testing was considered and rejected as not worth widening the module surface.)

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "if (!configuredSecret)" src/app/api/cron/*/route.ts` → both files present, each followed by a `return false` (check with `grep -A1`)
- [ ] `grep -rn "searchParams.get(\"secret\")" src/app/api/cron/` → no matches
- [ ] `pnpm exec tsc --noEmit` exits 0
- [ ] `pnpm exec vitest run` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)

## STOP conditions

Stop and report back (do not improvise) if:

- Either `authorized` function no longer matches the "Current state" excerpts.
- You find any caller in the repo that passes `?secret=` (re-grep before deleting the query path).

## Maintenance notes

- **DEPLOY GATE — read this**: production has NO `CRON_SECRET` set (verified via `wrangler secret list` on 2026-06-12). If this change deploys before the secret exists, both nightly crons (04:00 sync, 06:23 push-indexing) will get 401s and silently stop running. Before the next deploy the operator must run: `npx wrangler secret put CRON_SECRET` with a generated value (e.g. `openssl rand -hex 32` output). No code references the value; only the Worker env needs it.
- After deploying + setting the secret, verify the next cron actually ran (Cloudflare dashboard → Workers → Logs, or check that `indexing_push_checkpoint` advanced).
- The day-after check is the real done signal for this plan in production.
