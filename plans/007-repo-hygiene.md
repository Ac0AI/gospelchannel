# Plan 007: Repo hygiene — delete dead modules, drop the stale npm lockfile, fix docs, add typecheck to CI

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3e4c0127..HEAD -- src/lib/moved.ts src/lib/discovery.ts package-lock.json README.md CONTRIBUTING.md .github/workflows/ci.yml package.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" facts against the live repo before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt / dx / docs
- **Planned at**: commit `3e4c0127`, 2026-06-12

## Why this matters

This is a public open-source repo that outside contributors see. Right now it ships ~450 lines of dead code, two conflicting lockfiles (a contributor following the README's `npm install` instructions will corrupt dependency state — the README says npm 11 times while the project is pnpm-only), and a CI that never typechecks (`tsc --noEmit` passes today, but nothing keeps it that way). Each item is small; together they decide whether the repo reads as maintained.

## Current state

- `src/lib/moved.ts` (145 lines) and `src/lib/discovery.ts` (~300 lines) — zero imports anywhere: `grep -rn "from ['\"]@/lib/moved\|from ['\"]@/lib/discovery" src/ scripts/` → no matches (verified at planning time).
- `package-lock.json` (~629 KB, stale since April) coexists with `pnpm-lock.yaml`; `package.json:5` declares `"packageManager": "pnpm@10.33.0"`. CI uses pnpm.
- `README.md` — 9 `npm ` occurrences; `CONTRIBUTING.md` — 3 (e.g. `npm install`, `npm run dev`, `npm run lint`).
- `.github/workflows/ci.yml` — steps: install → `pnpm lint` → `pnpm exec vitest run` → `pnpm build`. No typecheck step. `pnpm exec tsc --noEmit` currently exits 0 (verified at planning time).
- `package.json` scripts block has no `typecheck` entry.
- Note: files like `scripts/backfill-owned-hero-images 2.mjs` are macOS duplicate artifacts but are NOT tracked by git (`git ls-files 'scripts/*' | grep ' 2'` → empty) — they are local-only and explicitly out of scope.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `pnpm install`           | exit 0              |
| Typecheck | `pnpm exec tsc --noEmit` | exit 0, no output   |
| Tests     | `pnpm exec vitest run`   | all pass            |
| Lint      | `pnpm lint`              | exit 0              |
| Build     | `pnpm build`             | exit 0              |

## Scope

**In scope** (the only files you should modify/delete):
- `src/lib/moved.ts` (delete)
- `src/lib/discovery.ts` (delete)
- `package-lock.json` (delete from git)
- `.gitignore` (add `package-lock.json`)
- `README.md`, `CONTRIBUTING.md` (npm → pnpm)
- `.github/workflows/ci.yml` (add typecheck step)
- `package.json` (add `"typecheck": "tsc --noEmit"` script)

**Out of scope** (do NOT touch):
- `src/lib/json-store.ts` and `src/lib/catalog.ts` — `discovery.ts` imports them, but they have OTHER consumers; after deleting discovery.ts, re-run the import grep for these two and REPORT whether they became orphans — do not delete them in this plan.
- Database tables (`videoMovedEvents` etc. in `src/db/schema/`) — schema cleanup is a separate decision.
- Untracked `scripts/* 2.mjs` files — local artifacts, not in git.
- Any other README content beyond the package-manager commands.

## Git workflow

- Branch: `advisor/007-repo-hygiene`
- Commit message style: conventional commits, e.g. `chore: drop dead modules, npm lockfile, add CI typecheck`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Confirm dead, then delete

Re-run `grep -rn "from ['\"]@/lib/moved\|from ['\"]@/lib/discovery\|lib/moved\|lib/discovery" src/ scripts/ worker.ts` (excluding the two files themselves). If still zero external references: `git rm src/lib/moved.ts src/lib/discovery.ts`.

**Verify**: `pnpm exec tsc --noEmit` → exit 0; `pnpm exec vitest run` → all pass.

### Step 2: Single lockfile

`git rm --cached package-lock.json && rm package-lock.json`, then add a line `package-lock.json` to `.gitignore`.

**Verify**: `git ls-files | grep package-lock.json` → empty; `pnpm install` → exit 0 (lockfile untouched or trivially updated).

### Step 3: Docs say pnpm

In `README.md` and `CONTRIBUTING.md`, replace every `npm install` → `pnpm install`, `npm run <x>` → `pnpm <x>`, and prerequisite mentions of npm with pnpm. Read each occurrence in context — do not blind-sed (one mention may be prose about the npm registry, which stays).

**Verify**: `grep -n "npm " README.md CONTRIBUTING.md | grep -v pnpm` → 0 matches (or only registry-prose matches you list in your report).

### Step 4: Typecheck in CI + script

In `package.json` scripts add `"typecheck": "tsc --noEmit"`. In `.github/workflows/ci.yml` add after the lint step:

```yaml
      - name: Run typecheck
        run: pnpm typecheck
```

**Verify**: `pnpm typecheck` → exit 0. YAML stays valid: `node -e "require('js-yaml')"` is NOT available — instead verify indentation matches the sibling steps exactly (2-space nesting, same as "Run lint").

### Step 5: Full sweep

**Verify**: `pnpm lint`, `pnpm exec vitest run`, `pnpm build` all exit 0.

## Test plan

No new tests — deletions and config. The full suite + build + typecheck are the gate.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `test ! -f src/lib/moved.ts && test ! -f src/lib/discovery.ts` → exit 0
- [ ] `git ls-files | grep -c package-lock.json` → 0
- [ ] `grep -c typecheck .github/workflows/ci.yml` → ≥1
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm exec vitest run`, `pnpm build` all exit 0
- [ ] `grep -rn "npm install" README.md CONTRIBUTING.md` → 0 matches
- [ ] No files outside the in-scope list are modified (`git status`)

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1's grep finds ANY reference to `moved` or `discovery` outside the two files (including dynamic imports — also grep for `import("@/lib/moved` and `import("@/lib/discovery`).
- Deleting them breaks the build or tests (a hidden consumer existed).
- README npm mentions turn out to be about something other than running commands.

## Maintenance notes

- Report (don't act on): whether `json-store.ts`/`catalog.ts` became orphans after Step 1 — candidates for a future deletion plan.
- The DB tables that `moved.ts` wrote to (`video_moved_*`) may still exist in Neon; dropping them is an operator decision (data loss), out of scope here.
- With typecheck in CI, contributors get type errors at PR time — keep the `typecheck` script name stable; plan 005's instructions reference these commands.
