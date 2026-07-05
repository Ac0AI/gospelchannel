# Plan 006: Close four small correctness/security gaps (vote race, upload extension, enrichment save, access-code abuse)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3e4c0127..HEAD -- src/app/api/church/vote/route.ts src/app/api/church/upload-image/route.ts src/lib/auto-enrich.ts src/app/api/church-admin/access-code/route.ts src/app/api/prayer/pray/route.ts`
> The vote route is EXPECTED to differ if plan 004 landed (captureServerEvent).
> Compare the excerpts below against live code for the SPECIFIC lines each fix
> touches; on a mismatch there, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (composes cleanly with 004; if both run, 004 first)
- **Category**: bug / security
- **Planned at**: commit `3e4c0127`, 2026-06-12

## Why this matters

Four small, independently verified gaps: (a) the church-vote endpoint sets its anti-abuse marker AFTER counting the vote, so concurrent requests can double-vote; (b) the image upload builds the stored filename from the uploader's own filename extension instead of the validated MIME type; (c) background AI-enrichment results are saved without checking the database response, so failures vanish silently; (d) the church-admin access-code endpoint has no rate limit, allowing unthrottled probing of which emails have claimed churches. Each fix is a few lines; bundling them keeps review cheap.

## Current state

**(a)** `src/app/api/church/vote/route.ts:43-46` — increment happens before the rate-limit marker is set:

```ts
  const votes = await incrementChurchVote(slug);
  if (ipKey) {
    await setKvRateLimit(ipKey, 60 * 60 * 24 * 7);
  }
```

(The follow route has the same ordering but its DB write is an idempotent upsert keyed on `church_slug,email` — no duplication is possible there, so it is intentionally NOT in scope.)

**(b)** `src/app/api/church/upload-image/route.ts:46-47` — extension from user filename:

```ts
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const filePath = `${target.folder}/${churchSlug}/${target.prefix}-${Date.now()}.${ext}`;
```

MIME type is already validated against an allowlist just above (lines 33-36): `image/jpeg`, `image/png`, `image/webp`, and `image/svg+xml` (SVG only when `target.allowSvg`).

**(c)** `src/lib/auto-enrich.ts` — `saveEnrichmentToSuggestion` (function starting ~line 144) awaits a neon-client facade update without inspecting the result. The facade returns `{ data, error }` and does NOT throw on a failed update:

```ts
  await client
    .from("church_suggestions")
    .update({ enrichment_data: { /* ... */ } })
    .eq("id", suggestionId);
```

**(d)** `src/app/api/church-admin/access-code/route.ts` — POST takes an email and answers whether verified church access exists (404 vs success), with no rate limiting. The repo's rate-limit convention is in `src/app/api/church/claim/route.ts:6,43-44,59-61,72-74`: `getClientIp`, `hasKvRateLimit`, `setKvRateLimit` from `@/lib/request-guards`, key pattern `"church:claim:<slug>:<ip>"`, check before work / set after work.

**(e)** `src/app/api/prayer/pray/route.ts:33-35` — the catch block swallows all errors without logging:

```ts
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
```

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `pnpm install`           | exit 0              |
| Typecheck | `pnpm exec tsc --noEmit` | exit 0, no output   |
| Tests     | `pnpm exec vitest run`   | all pass            |
| Lint      | `pnpm lint`              | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `src/app/api/church/vote/route.ts`
- `src/app/api/church/upload-image/route.ts`
- `src/lib/auto-enrich.ts`
- `src/app/api/church-admin/access-code/route.ts`
- `src/app/api/prayer/pray/route.ts`

**Out of scope** (do NOT touch):
- `src/app/api/church/follow/route.ts` — idempotent upsert, no race to fix (see above).
- `src/lib/request-guards.ts` — use it, don't change it.
- The vote cookie logic — it is a UX guard; the IP rate limit is the real control.

## Git workflow

- Branch: `advisor/006-small-correctness-fixes`
- One commit per fix (a-e) or a single commit; message style: conventional commits, e.g. `fix(vote): set rate-limit marker before counting`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1 (a): Set the vote marker before counting

In `src/app/api/church/vote/route.ts`, move the `setKvRateLimit` call ABOVE `incrementChurchVote`:

```ts
  if (ipKey) {
    await setKvRateLimit(ipKey, 60 * 60 * 24 * 7);
  }
  const votes = await incrementChurchVote(slug);
```

Trade-off (accepted, do not "fix"): if the increment then fails, the IP has consumed its vote window — acceptable for an anti-abuse guard.

**Verify**: `pnpm exec tsc --noEmit` → exit 0.

### Step 2 (b): Derive the stored extension from the validated MIME type

In `src/app/api/church/upload-image/route.ts`, replace the `ext` derivation (line 46) with a lookup keyed on the already-validated `file.type`:

```ts
  const EXT_BY_TYPE: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
  };
  const ext = EXT_BY_TYPE[file.type] ?? 'png';
```

(Place the map at module scope next to `ALLOWED_TYPES`.) `file.name` must no longer influence the stored path.

**Verify**: `grep -n "file.name" src/app/api/church/upload-image/route.ts` → 0 matches.

### Step 3 (c): Surface enrichment-save failures

In `src/lib/auto-enrich.ts`'s `saveEnrichmentToSuggestion`, capture and check the facade result:

```ts
  const { error } = await client
    .from("church_suggestions")
    .update({ /* unchanged payload */ })
    .eq("id", suggestionId);

  if (error) {
    throw new Error(`[auto-enrich] Failed to save enrichment for suggestion ${suggestionId}: ${error.message ?? String(error)}`);
  }
```

Throwing is correct here: the caller chain in `src/app/api/church/suggest/route.ts:107-115` already has `.catch((err) => console.error("[auto-enrich] Background error:", err))`.

**Verify**: `pnpm exec tsc --noEmit` → exit 0. (If the facade's update result is not typed with `.error`, STOP.)

### Step 4 (d): Rate-limit the access-code endpoint

In `src/app/api/church-admin/access-code/route.ts`, following the claim route's convention exactly: import `getClientIp`, `hasKvRateLimit`, `setKvRateLimit` from `@/lib/request-guards`; after email validation, with `const ip = getClientIp(request)` and key `church-admin:access:${ip}`: if `hasKvRateLimit` → return 429 `{ error: "Too many attempts. Please wait a few minutes." }`; after a SUCCESSFUL lookup (regardless of whether memberships were found), `await setKvRateLimit(key, 60 * 5)`. Skip rate limiting when `ip` is null (matches claim route behavior).

**Verify**: `grep -n "hasKvRateLimit\|setKvRateLimit" src/app/api/church-admin/access-code/route.ts` → both present.

### Step 5 (e): Log the swallowed prayer error

In `src/app/api/prayer/pray/route.ts`, change `} catch {` to `} catch (err) {` and add `console.error("[pray] Unexpected error:", err);` before the return.

**Verify**: `pnpm lint` → exit 0 (no unused-var complaint).

### Step 6: Full sweep

**Verify**: `pnpm exec vitest run` → all pass; `pnpm exec tsc --noEmit` → exit 0; `pnpm lint` → exit 0.

## Test plan

No new test files here — plan 005 adds route-level tests for upload-image; if 005 runs after this plan, its upload happy-path test should assert the stored key extension follows MIME, not filename. The done criteria greps pin each fix.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] In `vote/route.ts`, `setKvRateLimit` appears on an earlier line than `incrementChurchVote` (`grep -n` both)
- [ ] `grep -n "file.name" src/app/api/church/upload-image/route.ts` → 0 matches
- [ ] `grep -n "const { error }" src/lib/auto-enrich.ts` → ≥1 match inside `saveEnrichmentToSuggestion`
- [ ] `grep -n "hasKvRateLimit" src/app/api/church-admin/access-code/route.ts` → ≥1 match
- [ ] `grep -n "console.error" src/app/api/prayer/pray/route.ts` → ≥1 match
- [ ] `pnpm exec tsc --noEmit`, `pnpm exec vitest run`, `pnpm lint` all exit 0
- [ ] No files outside the in-scope list are modified (`git status`)

## STOP conditions

Stop and report back (do not improvise) if:

- The neon-client facade's `.update().eq()` result has no `error` property in its type (step 3 assumption false) — report the actual return type from `src/lib/neon-client.ts`.
- `getClientIp` is not exported from `@/lib/request-guards`.
- Any excerpt in Current state no longer matches the live code beyond what the drift note allows.

## Maintenance notes

- The vote endpoint still has a benign cookie-set-after-response race; the IP marker is now the authoritative guard. If vote integrity ever matters more (e.g. public leaderboards), move to a server-side tally keyed on IP+cookie hash.
- The access-code 404-vs-success distinction still reveals whether an email has a claimed church — the rate limit makes enumeration expensive, not impossible. Accepted for now; revisit if abuse appears in logs.
