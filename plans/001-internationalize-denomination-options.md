# Plan 001: Internationalize the denomination options in the church profile editor

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3e4c0127..HEAD -- src/lib/profile-fields.ts src/lib/profile-validation.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (product-fit)
- **Planned at**: commit `3e4c0127`, 2026-06-12

## Why this matters

GospelChannel is about to email churches in the UK and Spain inviting them to claim their church page. After claiming, churches edit their profile at `/church/[slug]/manage`. The "Denomination" dropdown there currently offers ONLY Swedish denominations (Pingst, EFK, Equmenia, Svenska kyrkan, ...). A church in Manchester or Madrid cannot describe itself — the most identity-defining field in the whole profile is unusable for the exact audience being onboarded. The repo already has a canonical international denomination taxonomy (`src/lib/denomination-taxonomy.ts`); the dropdown just never adopted it.

## Current state

- `src/lib/profile-fields.ts` — defines `PROFILE_FIELDS`, the field definitions rendered by the profile editor. The denomination field at lines 142-151:

```ts
  {
    name: 'denomination',
    label: 'Denomination',
    hint: 'Which denomination or network are you part of?',
    category: 'bonus',
    points: 8,
    type: 'select',
    options: ['Pingst', 'EFK', 'Equmenia', 'Svenska kyrkan', 'Katolska', 'Vineyard', 'Trosrörelsen', 'Frälsningsarmén', 'Baptistsamfundet', 'Annat'],
    validation: { maxLength: 100 },
  },
```

- `src/lib/profile-fields.ts:332` — `export const DENOMINATION_OPTIONS = PROFILE_FIELDS.find(f => f.name === 'denomination')!.options!;` — this export is not imported anywhere else in `src/` (verified with grep at planning time), so changing the options has no hidden consumers.
- `src/lib/profile-fields.ts:276-326` — `PROFILE_OPTION_LABELS` maps stored Swedish values to English display labels (e.g. `Pingst: 'Pentecostal'`). Existing churches may have Swedish values stored in `church_profile_edits`; this map keeps them displaying correctly. DO NOT remove existing entries.
- `src/lib/profile-validation.ts:80-85` — validation for `denomination` only checks non-empty; it does NOT enforce membership in the options list:

```ts
    case 'denomination':
    case 'theological_orientation':
    case 'church_size': {
      if (!value || String(value).trim().length === 0) return 'Select an option';
      return null;
    }
```

- `src/lib/denomination-taxonomy.ts` — the canonical taxonomy ("Single source of truth for categorizing churches by tradition"). Its canonical values are exactly: `Pentecostal`, `Charismatic`, `Baptist`, `Anglican`, `Lutheran`, `Catholic`, `Methodist`, `Reformed`, `Evangelical`, `Non-denominational`, `Orthodox`.
- The manage UI (`src/app/church/[slug]/manage/profile-manage-client.tsx:389,405`) renders `field.options` directly into `<option>` elements — no change needed there.
- Submitted denomination values are auto-verified against enrichment data in `src/lib/auto-verify.ts:54-61` with a fuzzy containment check; a non-match just routes the edit to admin review ("pending"), which is acceptable.

Repo conventions: TypeScript, single-quote strings in this file, trailing commas. Match the surrounding style exactly.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `pnpm install`           | exit 0              |
| Typecheck | `pnpm exec tsc --noEmit` | exit 0, no output   |
| Tests     | `pnpm exec vitest run`   | all pass            |
| Lint      | `pnpm lint`              | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `src/lib/profile-fields.ts`
- `src/lib/__tests__/profile-fields.test.ts` (create)

**Out of scope** (do NOT touch, even though they look related):
- `src/lib/denomination-taxonomy.ts` — the canonical taxonomy; the dropdown adopts ITS values, never the reverse.
- `src/lib/profile-validation.ts` — validation intentionally does not enforce option membership; leave it.
- `src/app/church/[slug]/manage/profile-manage-client.tsx` — renders options generically; no change needed.
- Any database migration or script — stored Swedish values stay as they are; the label map handles display.

## Git workflow

- Branch: `advisor/001-denomination-options`
- Commit message style: conventional commits, e.g. `fix(profile): international denomination options for claim flow` (matches repo history like `fix(seo): noindex thin city hubs`)
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Replace the denomination options

In `src/lib/profile-fields.ts`, replace the `options` array of the `denomination` field (line 149) with:

```ts
    options: ['Pentecostal', 'Charismatic', 'Evangelical', 'Baptist', 'Anglican', 'Lutheran', 'Methodist', 'Reformed', 'Non-denominational', 'Vineyard', 'Catholic', 'Orthodox', 'Other'],
```

Rationale for the order: free-church/evangelical traditions first (the site's primary audience), broad-church traditions after, `Other` last. `Vineyard` is kept from the old list because it is a real international network the taxonomy also recognizes.

**Verify**: `pnpm exec tsc --noEmit` → exit 0, no output.

### Step 2: Keep legacy values displayable

In `PROFILE_OPTION_LABELS` (same file, lines 276-326), confirm the existing Swedish entries (`Pingst`, `EFK`, `Equmenia`, `Svenska kyrkan`, `Katolska`, `Trosrörelsen`, `Frälsningsarmén`, `Baptistsamfundet`, `Annat`) are still present — they keep previously stored Swedish edits rendering as English. Do not add entries for the new English values; `getProfileOptionLabel` already falls back to the raw value (line 328-330).

**Verify**: `grep -c "Pingst\|Frälsningsarmén" src/lib/profile-fields.ts` → at least 2 matches remain.

### Step 3: Add a regression test

Create `src/lib/__tests__/profile-fields.test.ts`, modeled structurally on `src/lib/__tests__/auto-verify.test.ts` (vitest, `describe`/`it`/`expect`, imports from `'../profile-fields'`). Test cases:

1. `DENOMINATION_OPTIONS` contains no Swedish-only values: expect it NOT to include `'Pingst'`, `'EFK'`, `'Equmenia'`, `'Svenska kyrkan'`, `'Annat'`.
2. Every `DENOMINATION_OPTIONS` value except `'Other'` and `'Vineyard'` is one of the canonical values exported from the taxonomy. Import `DENOMINATIONS` from `'../denomination-taxonomy'` and build `new Set(DENOMINATIONS.map(d => d.canonical))`.
3. `getProfileOptionLabel('Pingst')` still returns `'Pentecostal'` (legacy display path).

**Verify**: `pnpm exec vitest run src/lib/__tests__/profile-fields.test.ts` → 3 tests pass.

## Test plan

Covered by Step 3. Full-suite check in done criteria.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm exec tsc --noEmit` exits 0
- [ ] `pnpm exec vitest run` exits 0; the 3 new tests pass
- [ ] `pnpm lint` exits 0
- [ ] `grep -n "Svenska kyrkan" src/lib/profile-fields.ts` matches ONLY inside `PROFILE_OPTION_LABELS` (one match, line ~280), not in the options array
- [ ] No files outside the in-scope list are modified (`git status`)

## STOP conditions

Stop and report back (do not improvise) if:

- The denomination field in `profile-fields.ts` does not match the "Current state" excerpt (drift).
- `DENOMINATION_OPTIONS` turns out to be imported somewhere in `src/` after all (re-run `grep -rn "DENOMINATION_OPTIONS" src/ --include="*.ts" --include="*.tsx"` — if more than the self-reference at profile-fields.ts:332 appears, stop).
- Any existing test fails after the change.

## Maintenance notes

- If a future plan adds country-aware option lists (e.g. showing Pingst/EFK to Swedish churches), the place to do it is a filter over the taxonomy by country, not a second hard-coded list.
- Reviewer should check: stored Swedish values still render in English on a church page with an old denomination edit.
- Deferred: the `ministries` checkbox options are also Swedish values (displayed via the label map, so they work) — harmonizing them to English values requires a data migration for stored edits and was deliberately left out.
