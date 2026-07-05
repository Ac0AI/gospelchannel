# Plan 005: Test the claim flow's write paths (claim submission, admin gate, image upload validation)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3e4c0127..HEAD -- src/app/api/church/claim/route.ts src/lib/admin-route.ts src/app/api/church/upload-image/route.ts`
> The claim route and upload route are EXPECTED to have changed if plans 004/006
> landed first (PostHog helper, extension whitelist) — read the live files and
> adjust mocks/assertions to the live code. Any OTHER kind of drift is a STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED — route-level testing with mocks is new to this repo; brittle mocks are the failure mode
- **Depends on**: plans/004-posthog-reliability-claim-funnel.md (mocks target `captureServerEvent`); run after 006 if possible (upload assertions)
- **Category**: tests
- **Planned at**: commit `3e4c0127`, 2026-06-12

## Why this matters

The church-claim flow is the site's conversion path — an outreach campaign is about to drive real churches through it — and none of its write endpoints have any test coverage. The 26 existing vitest files cover pure logic only. A regression in claim validation, the admin authorization gate, or upload ownership checks would reach production unnoticed. This plan adds route-level tests for the three highest-stakes pieces: claim submission, `requireAdminRoute` (the gate in front of every admin endpoint), and upload-image validation/authorization.

## Current state

- Tests live in `src/lib/__tests__/*.test.ts`, run by `pnpm exec vitest run` (config: `vitest.config.ts`, node environment, `@` aliased to `./src`). Structural exemplar: `src/lib/__tests__/auto-verify.test.ts` (plain `describe`/`it`/`expect`).
- No existing test mocks modules — this plan introduces `vi.mock`. Vitest hoists `vi.mock` calls; mock factories must not reference out-of-scope variables.
- `src/lib/admin-route.ts` (45 lines) — `requireAdminRoute(request)` returns `{ ok: false, response }` in three cases, in this order:
  1. `!process.env.BETTER_AUTH_URL || !process.env.BETTER_AUTH_SECRET` → 500 "Better Auth is not configured"
  2. `await getServerUser(request.headers)` returns null → 401 "Unauthorized"
  3. `await isAdminUser(user.id)` false → 403 "Forbidden"
  and `{ ok: true, user, json, respond }` on success. Dependencies to mock: `@/lib/auth/server` (`getServerUser`) and `@/lib/admin-users` (`isAdminUser`).
- `src/app/api/church/claim/route.ts` — `POST` handler. Order of checks (each is a testable branch):
  1. unparseable JSON body → 400 `{ error: "Invalid request" }`
  2. honeypot: `isBotTrapFilled(payload.companyWebsite)` → fake success `{ success: true, ... }` WITHOUT calling `addChurchClaim`
  3. unknown church (`getChurchBySlugAsync` → null) → 404
  4. name shorter than 2 chars → 400
  5. invalid email → 400
  6. `hasKvRateLimit` true → 429
  7. happy path → `addChurchClaim` called, rate limit set, PostHog captured, emails dispatched via `ctx.waitUntil`, response `{ success: true, id, message }`
  Dependencies to mock: `@/lib/church-community` (`addChurchClaim`), `@/lib/content` (`getChurchBySlugAsync`), `@/lib/email` (`sendClaimReceivedEmail`, `sendClaimAdminNotification`), `@/lib/request-guards` (`getClientIp`, `hasKvRateLimit`, `isBotTrapFilled`, `setKvRateLimit`), `@/lib/posthog-server` (`captureServerEvent` after plan 004; `getPostHogClient` returning `{ capture: vi.fn() }` if 004 has not landed), `@opennextjs/cloudflare` (`getCloudflareContext` → `{ ctx: { waitUntil: vi.fn() } }`).
- `src/app/api/church/upload-image/route.ts` — `POST` handler. Branches:
  1. `getServerUser` null → 401
  2. missing file/churchSlug/fieldName → 400
  3. unknown `fieldName` (not in `IMAGE_TARGETS`: `logo_url`, `cover_image_url`, `pastor_photo_url`) → 400
  4. disallowed MIME type (SVG allowed only for `logo_url`) → 400
  5. `file.size > 2 * 1024 * 1024` → 400 "Max 2 MB"
  6. `getChurchMembershipForUserAndSlug` null → 403 (the ownership check)
  Dependencies to mock: `@/lib/auth/server`, `@/lib/church-community`, `@/lib/neon-client` (`createAdminClient` — only reached on the success path; a happy-path test may mock `storage.from().upload` to return `{ error: null }` and `getPublicUrl` to return `{ data: { publicUrl: 'https://example.com/x.png' } }`).
- Route handlers take a `NextRequest`. In vitest's node environment construct one with `new NextRequest("http://localhost/api/x", { method: "POST", body: JSON.stringify({...}), headers: { "content-type": "application/json" } })` (import from `next/server`). For upload tests build a `FormData` with `new File([new Uint8Array(10)], "logo.png", { type: "image/png" })` and pass it as `body` (do NOT set content-type manually — let the runtime set the multipart boundary).

## Commands you will need

| Purpose   | Command                                              | Expected on success |
|-----------|------------------------------------------------------|---------------------|
| Install   | `pnpm install`                                       | exit 0              |
| One file  | `pnpm exec vitest run src/lib/__tests__/<file>`      | listed tests pass   |
| All tests | `pnpm exec vitest run`                               | all pass            |
| Typecheck | `pnpm exec tsc --noEmit`                             | exit 0              |
| Lint      | `pnpm lint`                                          | exit 0              |

## Scope

**In scope** (the only files you should create/modify):
- `src/lib/__tests__/admin-route.test.ts` (create)
- `src/lib/__tests__/claim-route.test.ts` (create)
- `src/lib/__tests__/upload-image-route.test.ts` (create)

**Out of scope** (do NOT touch):
- Any production source file. If a route seems untestable without a source change, STOP and report — do not refactor source in this plan.
- Vote/follow/prayer routes — same technique applies, deliberately deferred to keep this plan reviewable.
- `vitest.config.ts` — the node environment suffices.

## Git workflow

- Branch: `advisor/005-claim-flow-tests`
- Commit message style: conventional commits, e.g. `test(claim): route-level coverage for claim, admin gate, upload validation`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: admin-route.test.ts

`vi.mock("@/lib/auth/server")` and `vi.mock("@/lib/admin-users")`. Use `vi.stubEnv("BETTER_AUTH_URL", ...)`/`vi.stubEnv("BETTER_AUTH_SECRET", ...)` (and `vi.unstubAllEnvs` in `afterEach`) for the env branch. Cases:

1. env missing → `ok: false`, `response.status === 500`
2. env set, `getServerUser` → null → 401
3. user present, `isAdminUser` → false → 403
4. user present + admin → `ok: true`, `user` passed through

**Verify**: `pnpm exec vitest run src/lib/__tests__/admin-route.test.ts` → 4 tests pass.

### Step 2: claim-route.test.ts

Mock the modules listed in Current state. Import `{ POST }` from `@/app/api/church/claim/route` AFTER the mocks. Default mock behaviors: church exists (`{ slug: "test-church", name: "Test Church" }`), no rate limit, honeypot empty, `addChurchClaim` resolves `{ id: "claim-1" }`. Cases (reset mocks in `beforeEach`):

1. malformed JSON body → 400
2. honeypot filled → 200 `{ success: true }` AND `expect(addChurchClaim).not.toHaveBeenCalled()`
3. unknown church → 404
4. name "A" → 400
5. email "not-an-email" → 400
6. rate-limited → 429
7. happy path → 200 with `id: "claim-1"`, `addChurchClaim` called once with the sanitized payload, `waitUntil` called once

**Verify**: `pnpm exec vitest run src/lib/__tests__/claim-route.test.ts` → 7 tests pass.

### Step 3: upload-image-route.test.ts

Cases:

1. unauthenticated → 401
2. missing fieldName → 400
3. `fieldName: "hero_url"` (unknown) → 400
4. SVG to `cover_image_url` → 400 (SVG only allowed for `logo_url`)
5. 3 MB file → 400
6. authenticated but no membership → 403 AND upload never called
7. happy path (png to `logo_url`, membership exists) → 200 with a `url` in the body

**Verify**: `pnpm exec vitest run src/lib/__tests__/upload-image-route.test.ts` → 7 tests pass.

### Step 4: Full sweep

**Verify**: `pnpm exec vitest run` → all pass (existing suite + 18 new). `pnpm exec tsc --noEmit` → exit 0. `pnpm lint` → exit 0.

## Test plan

This plan IS the test plan. Quality bar for the reviewer: every test asserts on status code AND (where applicable) on mock call counts — a test that only checks "didn't throw" does not count.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] 3 new test files exist at the in-scope paths
- [ ] `pnpm exec vitest run` exits 0 and reports ≥18 more tests than before (baseline: run on HEAD before your branch — record both numbers in your report)
- [ ] `pnpm exec tsc --noEmit` and `pnpm lint` exit 0
- [ ] `git status` shows only the 3 new files

## STOP conditions

Stop and report back (do not improvise) if:

- `NextRequest` construction fails in the vitest node environment (e.g. undici incompatibility) after one reasonable attempt at the documented constructor form — report the error; do not switch testing libraries or add jsdom.
- A route imports something at module load that throws without further env/mocking (e.g. a DB client constructed at import time) — report which module; do not modify the source.
- Any existing test breaks.

## Maintenance notes

- These tests pin the claim flow's contract (status codes, honeypot behavior, ownership checks). When plan 006 lands (upload extension whitelist), case 7 of upload tests should additionally assert the R2 key ends in `.png` for a `image/png` upload regardless of the uploaded filename — add it then if not already running after 006.
- The same mocking recipe extends to vote/follow/prayer routes — a natural follow-up plan once this one proves the pattern.
