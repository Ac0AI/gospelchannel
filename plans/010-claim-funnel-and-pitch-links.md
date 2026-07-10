# Plan 010: Point the church funnel at claiming and make the preview pitch deliverable

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7508bb95..HEAD -- src/app/for-churches/page.tsx scripts/export-preview-links.mjs`
> If `for-churches/page.tsx` changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (independent of 008/009)
- **Category**: direction / monetization
- **Planned at**: commit `7508bb95` (branch `geo-seo-decision-engine`), 2026-07-07

## Why this matters

The business is pivoting to selling SEO/GEO services to US churches, with cold
outreach (lemlist) as the channel. Three things are misaligned in the code:

1. **The best pitch asset is dark.** Every approved church already has a
   token-gated personal preview page (`/preview/[slug]?token=...`) showing
   "your page today vs. filled in" with a completeness score — and
   `claim_preview_token` is backfilled for all approved churches. But no
   script or email ever emits that URL; outreach goes out generic while the
   personalized demo sits unused. This plan adds the export that turns those
   URLs into lemlist merge fields.
2. **The conversion page sells the wrong verb.** All three primary CTAs on
   `/for-churches` link to `/church/suggest` (add a NEW church — zero
   submissions ever), while "claim your existing page" — the action that
   creates an owner relationship, a login, and a pitchable contact — is a
   secondary outline button. 72,000+ churches are already listed; for nearly
   every visiting church leader, claiming IS the correct action.
3. **The page promises what the product doesn't do.** Copy says verification
   is a self-serve emailed code ("One step") and edits are "live immediately.
   No review queue." In reality a claim creates a `pending` row that an admin
   must approve, and the owner dashboard itself says "Updates go into review
   before they are applied." Broken promises at the moment of highest intent
   burn exactly the trust the pitch needs. (Per repo policy: sales copy may be
   bold, but concrete claims to customers must be true.)

## Current state

Relevant files:

- `src/app/for-churches/page.tsx` — the conversion page. Hero CTA block at
  lines ~154-168; pricing-box CTA at ~318-324; final CTA block at ~367-378;
  `STEPS` copy array at lines 59-64; `FAQ` copy array at lines 66-73.
- `src/app/preview/[slug]/page.tsx` — token-gated preview.
  `validateToken(slug, token)` at lines 18-27 checks
  `churches.claim_preview_token`. Page is `noindex, nofollow`.
- `scripts/backfill-preview-tokens.mjs` — the script that generated tokens for
  all approved churches; its env/DB conventions are the pattern for the new
  export script.
- `scripts/export-preview-links.mjs` — does NOT exist; you create it.
- Claim reality (for the copy fix): `src/app/api/church/claim/route.ts`
  inserts a claim with status `pending` and sends a "submitted for review"
  email; admin verification happens via
  `src/app/api/admin/claims/verify/route.ts`. The owner dashboard
  (`src/app/church-admin/page.tsx:42`) tells owners "Updates go into review
  before they are applied." Do not change any of these routes — the copy must
  match them, not the other way around.

Excerpt — hero CTAs (`src/app/for-churches/page.tsx:154-168`):

```tsx
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/church/suggest"
                className="rounded-full bg-rose-gold px-7 py-4 text-sm font-bold text-white transition-all duration-150 hover:-translate-y-px hover:bg-rose-gold-deep hover:shadow-[0_8px_24px_rgba(176,106,80,0.3)]"
              >
                Add your church
              </Link>
              <Link
                href="/church"
                className="rounded-full border border-rose-gold/30 px-7 py-4 text-sm font-semibold text-espresso transition-colors hover:bg-rose-gold/[0.06]"
              >
                Claim existing page
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-warm">Takes 4 minutes. Completely free.</p>
```

Excerpt — the over-promising copy (`src/app/for-churches/page.tsx:59-73`):

```ts
const STEPS = [
  { n: "1", t: "Find or add", d: "Search for your church. If we have it, claim it. If not, add it in 2 minutes." },
  { n: "2", t: "Verify", d: "We send a code to the church email or phone on file. One step." },
  { n: "3", t: "Polish", d: "Add photos, music links, service times. Live preview as you go." },
  { n: "4", t: "Publish", d: "Press publish. The page is live. Edit anytime, no review queue." },
];

const FAQ = [
  ...
  { q: "Can I edit the page anytime?", a: "Yes. Changes are live immediately. No review queue. You can also add multiple admins from your team." },
  ...
];
```

Excerpt — the env/DB conventions for scripts (`scripts/backfill-preview-tokens.mjs:8-16`):

```js
import pkg from "@next/env";
const { loadEnvConfig } = pkg;
import { neon } from "@neondatabase/serverless";
import { randomBytes } from "crypto";

loadEnvConfig(process.cwd());

const dryRun = process.argv.includes("--dry-run");
const sql = neon(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL);
```

Brand/copy rules that bind this plan (from CLAUDE.md): never an em-dash in
site copy (use a period or regular dash); confident category-leader tone is
wanted; but concrete claims about how the product works must be literally true.

## Commands you will need

| Purpose   | Command                                            | Expected on success |
|-----------|----------------------------------------------------|---------------------|
| Typecheck | `pnpm exec tsc --noEmit`                           | exit 0              |
| Tests     | `pnpm exec vitest run src/lib/__tests__/`          | all pass            |
| Script dry-run | `node scripts/export-preview-links.mjs --dry-run` | prints count + 3 sample rows, writes nothing |

**IMPORTANT**: plain `pnpm typecheck` fails in this environment
(`ERR_PNPM_UNSUPPORTED_ENGINE`, Node 26 vs pinned 22). Use `pnpm exec` forms.

## Scope

**In scope** (the only files you should modify or create):

- `src/app/for-churches/page.tsx` (CTA hrefs/labels + STEPS/FAQ copy only)
- `scripts/export-preview-links.mjs` (create)

**Out of scope** (do NOT touch):

- The claim/verify API routes and `church-admin` pages — behavior stays as is;
  only the marketing copy moves to match it.
- `src/app/preview/[slug]/page.tsx` — works as is.
- Automating verification codes (real self-serve claiming) — a product
  decision deferred until claim volume justifies it.
- The lemlist campaign itself (external tool) — this plan only produces the
  CSV it needs.
- Rendering `church_website_tech.sales_angle` publicly — its text is internal
  sales language, not customer-facing; a church-facing health report needs
  content design first. Deferred (see plans/README.md).
- `church_outreach` table wiring — separate decision, deferred.

## Git workflow

- Branch: work directly on `geo-seo-decision-engine`.
- Commit style: conventional commits, e.g.
  `feat(growth): point for-churches funnel at claiming, export preview links`.
- Do NOT push or deploy unless the operator instructed it.

## Steps

### Step 1: Make claiming the primary CTA

In `src/app/for-churches/page.tsx`:

1. **Hero block (lines ~154-168)**: swap the two links so the FILLED
   (rose-gold) button is `href="/church"` with label `Claim your church page`,
   and the OUTLINE button is `href="/church/suggest"` with label
   `Add a new church`. Keep each button's existing className exactly as it is
   (the filled style stays on the first/primary button — only hrefs and labels
   move).
2. **Pricing box CTA (lines ~318-324)**: change `href="/church/suggest"` to
   `href="/church"` and label `Add your church free` to
   `Claim your church page`.
3. **Final CTA block (lines ~367-378)**: change the filled button from
   `href="/church/suggest"` / `Add your church free` to `href="/church"` /
   `Claim your church page`. Leave the `Talk to us first` contact button as is.
4. Update the hero microcopy line `Takes 4 minutes. Completely free.` to
   `Free forever. Claiming takes about 4 minutes.` (keeps the promise honest:
   the 4 minutes is the form, not the approval).

**Verify**:
- `grep -c 'href="/church/suggest"' src/app/for-churches/page.tsx` → `1`
  (only the hero's secondary button remains).
- `grep -c 'Claim your church page' src/app/for-churches/page.tsx` → `3`.
- `pnpm exec tsc --noEmit` → exit 0.

### Step 2: Make the process copy truthful

In the same file, edit ONLY these strings:

1. `STEPS` entry 2 (`Verify`): replace
   `"We send a code to the church email or phone on file. One step."` with
   `"We check your claim against the church's official email or website and approve it, usually within a day."`
2. `STEPS` entry 4 (`Publish`): replace
   `"Press publish. The page is live. Edit anytime, no review queue."` with
   `"Your page is live from day one. Submit edits anytime and we publish them after a quick review."`
3. `FAQ` "Can I edit the page anytime?": replace the answer with
   `"Yes. Submit changes anytime and they go live after a quick review, usually the same day. You can also add multiple admins from your team."`

Note: "usually within a day" / "usually the same day" are commitments the
operator makes by shipping this copy — flag them in your completion report so
the operator consciously accepts them (they review claims manually).

Do not introduce any em-dash characters in the copy.

**Verify**:
- `grep -c "no review queue" src/app/for-churches/page.tsx` → `0` (case-insensitive check too: `grep -ci "no review queue"` → `0`).
- `grep -c "live immediately" src/app/for-churches/page.tsx` → `0`.
- `pnpm exec tsc --noEmit` → exit 0.

### Step 3: Create the preview-link export script

Create `scripts/export-preview-links.mjs`, modeled on
`scripts/backfill-preview-tokens.mjs` (same imports, same
`loadEnvConfig(process.cwd())`, same `DATABASE_URL_UNPOOLED || DATABASE_URL`
fallback — copy that header verbatim). Behavior:

1. Flags: `--dry-run` (print count + first 3 rows, write nothing),
   `--country <name>` (optional filter, matches `churches.country` exactly),
   `--out <path>` (default `tmp/preview-links.csv`).
2. Query: approved churches with a token and a contactable email —
   ```sql
   SELECT c.slug, c.name, c.location, c.country, c.email, c.claim_preview_token
   FROM churches c
   WHERE c.status = 'approved'
     AND c.claim_preview_token IS NOT NULL
     AND c.email IS NOT NULL AND c.email <> ''
   ORDER BY c.country, c.slug
   ```
   (add `AND c.country = $1` when `--country` is passed).
3. Output CSV with header
   `email,churchName,city,country,slug,previewUrl,profileUrl` where
   `previewUrl` is
   `https://gospelchannel.com/preview/{slug}?token={claim_preview_token}` and
   `profileUrl` is `https://gospelchannel.com/church/{slug}`. `city` is the
   part of `location` before the first comma (empty if none). CSV-escape
   fields containing commas/quotes (wrap in double quotes, double inner
   quotes) — church names contain commas.
4. Print a summary line: total rows written and the output path.
5. Do NOT print tokens or emails to stdout beyond the 3 dry-run samples.

The output lands in `tmp/` which is not committed (verify: `git check-ignore tmp/preview-links.csv`
→ prints the path; if tmp/ is NOT ignored, write to
`/private/tmp/` instead and say so in the report — never commit emails+tokens,
the repo is public).

**Verify**:
- `node scripts/export-preview-links.mjs --dry-run` → prints a count in the
  tens of thousands and 3 sample rows with well-formed URLs.
- `node scripts/export-preview-links.mjs --dry-run --country "United States"`
  → prints a smaller count than the unfiltered run.
- `git status --short scripts/` shows only the new script; no CSV staged.

## Test plan

- No new unit tests: the page change is copy/hrefs (covered by typecheck) and
  the script is operational tooling verified by its dry-run gates above.
- Existing suites stay green: `pnpm exec vitest run src/lib/__tests__/` → all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm exec tsc --noEmit` exits 0
- [ ] `pnpm exec vitest run src/lib/__tests__/` exits 0
- [ ] `grep -c 'href="/church/suggest"' src/app/for-churches/page.tsx` → 1
- [ ] `grep -ci "no review queue" src/app/for-churches/page.tsx` → 0
- [ ] `node scripts/export-preview-links.mjs --dry-run` exits 0 with count > 10000
- [ ] No CSV file is tracked by git (`git status --short` clean of tmp/ output)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The CTA blocks or STEPS/FAQ arrays in `for-churches/page.tsx` don't match
  the excerpts (page was redesigned since planning).
- The dry-run count is below 10,000 (expected ~30k approved churches with
  email + token; a tiny count means the token backfill assumption is wrong).
- `DATABASE_URL` is missing from the environment (env not loaded — do not
  hardcode any connection string).
- You are tempted to also change the claim/verify routes to match the OLD copy
  (self-serve codes) — that is explicitly out of scope.

## Maintenance notes

- The exported CSV contains live preview tokens + church emails: treat as
  sensitive, never commit (repo is public), delete after import into the
  outreach tool.
- If the claim flow later becomes truly self-serve (emailed codes), revert the
  Step 2 copy to the stronger promise — leave a code comment? No: note it in
  the commit message instead.
- Deferred follow-ups recorded in plans/README.md: church-facing website-health
  report (needs customer-safe wording, `sales_angle` is internal), wiring
  `church_outreach` as the in-house CRM, US edition of the church-tech report.
