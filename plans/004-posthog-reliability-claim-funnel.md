# Plan 004: Make server-side PostHog events survive the Workers runtime and complete the claim funnel

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3e4c0127..HEAD -- src/lib/posthog-server.ts src/app/api/church/claim/route.ts src/app/api/church/vote/route.ts src/app/api/church/follow/route.ts src/app/api/church/suggest/route.ts src/app/api/prayer/pray/route.ts src/app/api/admin/claims/verify/route.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (observability)
- **Planned at**: commit `3e4c0127`, 2026-06-12

## Why this matters

The site measures its church-claim funnel (claim submitted → verified → profile edited) with server-side PostHog events. On Cloudflare Workers, a `fetch` started after the response returns is killed with the isolate unless it is registered with `ctx.waitUntil()`. All five server-side `capture()` call sites fire-and-forget, so events are silently dropped an unknown fraction of the time. The site has ~13 real visitors/day — losing even a few funnel events makes the upcoming church-outreach campaign unmeasurable. Additionally, the funnel has a hole: claim *verification* (the conversion moment) emits no event at all.

## Current state

- `src/lib/posthog-server.ts` (entire file, 15 lines) — lazily constructs a singleton `PostHog` from `posthog-node` with `flushAt: 1, flushInterval: 0` (each capture flushes immediately — the in-flight fetch is what needs protecting):

```ts
import { PostHog } from "posthog-node";

let posthogClient: PostHog | null = null;

export function getPostHogClient(): PostHog {
  if (!posthogClient) {
    posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogClient;
}
```

- The five fire-and-forget call sites (all the same shape — `getPostHogClient().capture({...})` with no await/waitUntil):
  - `src/app/api/church/claim/route.ts:76` (event `church_claim_received`)
  - `src/app/api/church/suggest/route.ts:99` (event `church_suggestion_received`)
  - `src/app/api/church/vote/route.ts:48` (event `church_voted`)
  - `src/app/api/church/follow/route.ts:56` (event `church_follow_received`)
  - `src/app/api/prayer/pray/route.ts:27` (event `prayer_prayed`)
- The repo's established pattern for background work on Workers — `src/app/api/church/claim/route.ts:84-94`:

```ts
    const { ctx } = await getCloudflareContext({ async: true });
    ctx.waitUntil(
      Promise.all([ /* email sends with .catch(...) */ ]),
    );
```

- `src/app/api/admin/claims/verify/route.ts` — verifies a claim, emails the claimant via `ctx.waitUntil`, but captures NO PostHog event. It already imports `getCloudflareContext` (line 2) and has `result.email` / `result.churchSlug` / `payload.id` in scope at lines 22-35.
- `posthog-node` v5 exposes `flush(): Promise<void>` on the client.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `pnpm install`           | exit 0              |
| Typecheck | `pnpm exec tsc --noEmit` | exit 0, no output   |
| Tests     | `pnpm exec vitest run`   | all pass            |
| Lint      | `pnpm lint`              | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `src/lib/posthog-server.ts`
- `src/app/api/church/claim/route.ts`
- `src/app/api/church/suggest/route.ts`
- `src/app/api/church/vote/route.ts`
- `src/app/api/church/follow/route.ts`
- `src/app/api/prayer/pray/route.ts`
- `src/app/api/admin/claims/verify/route.ts`

**Out of scope** (do NOT touch):
- Client-side PostHog (`posthog-js`) setup — unaffected.
- `src/app/api/church/profile/route.ts` — adding a profile-edit event is listed as deferred follow-up, not this plan.
- Any change to event names or properties of the five existing events — dashboards may reference them.

## Git workflow

- Branch: `advisor/004-posthog-waituntil`
- Commit message style: conventional commits, e.g. `fix(analytics): keep server events alive via waitUntil + claim_verified event`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add a helper that captures and protects the flush

In `src/lib/posthog-server.ts`, add (keeping the existing export untouched):

```ts
import { getCloudflareContext } from "@opennextjs/cloudflare";

type CaptureArgs = Parameters<PostHog["capture"]>[0];

export async function captureServerEvent(event: CaptureArgs): Promise<void> {
  const client = getPostHogClient();
  client.capture(event);
  const flush = client.flush().catch((err) => {
    console.error("[posthog] flush failed:", err);
  });
  try {
    const { ctx } = await getCloudflareContext({ async: true });
    ctx.waitUntil(flush);
  } catch {
    // Outside the Workers runtime (e.g. plain `next dev`): nothing to keep alive.
  }
}
```

**Verify**: `pnpm exec tsc --noEmit` → exit 0. (If `flush()` is not typed as returning a Promise in the installed posthog-node version, STOP — see STOP conditions.)

### Step 2: Switch the five call sites to the helper

In each of the five route files, replace `getPostHogClient().capture({ ... })` with `await captureServerEvent({ ... })` (same object literal, unchanged event name and properties), and change the import from `getPostHogClient` to `captureServerEvent`. Note `prayer/pray/route.ts`'s capture sits inside a `try` block — keep it there.

**Verify**: `grep -rn "getPostHogClient" src/app/api/` → no matches (the helper is now the only consumer in `src/lib/posthog-server.ts`).

### Step 3: Emit the missing funnel event on claim verification

In `src/app/api/admin/claims/verify/route.ts`, after the `revalidateChurchClaimStatus()` call (line 23) and before the response, add:

```ts
    await captureServerEvent({
      distinctId: result.email,
      event: "church_claim_verified",
      properties: { church_slug: result.churchSlug, claim_id: payload.id },
    });
```

Import `captureServerEvent` from `@/lib/posthog-server`.

**Verify**: `pnpm exec tsc --noEmit` → exit 0.

### Step 4: Full sweep

**Verify**: `pnpm lint` → exit 0; `pnpm exec vitest run` → all pass.

## Test plan

No new tests: the helper's behavior is runtime-environment-dependent (Workers context) and the call sites are covered by plan 005's route tests, which mock `@/lib/posthog-server` — those mocks must target `captureServerEvent` (plan 005 is written against this plan landing first).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -rn "getPostHogClient" src/app/` → 0 matches
- [ ] `grep -rln "captureServerEvent" src/app/api/` → exactly 6 files (claim, suggest, vote, follow, pray, admin claims verify)
- [ ] `grep -n "church_claim_verified" src/app/api/admin/claims/verify/route.ts` → 1 match
- [ ] `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm exec vitest run` all exit 0
- [ ] No files outside the in-scope list are modified (`git status`)

## STOP conditions

Stop and report back (do not improvise) if:

- `client.flush()` does not typecheck as `Promise<void>` (older posthog-node API) — report the installed version and its flush/shutdown signatures instead of guessing.
- Any call site does not match the "Current state" line references.
- `getCloudflareContext({ async: true })` cannot be imported in `src/lib/posthog-server.ts` for a build-layer reason (e.g. the module is also imported from a non-server context) — report where it is imported from.

## Maintenance notes

- Any FUTURE server-side capture must go through `captureServerEvent` — a bare `getPostHogClient().capture()` in a route is a review red flag from now on.
- Deferred: a `church_profile_edit_submitted` event in `src/app/api/church/profile/route.ts` would complete the funnel's last leg (claim → verify → edit). One-line addition with the same helper once this lands.
- The funnel events to build the PostHog insight from: `church_claim_received` → `church_claim_verified` → (future) `church_profile_edit_submitted`.
