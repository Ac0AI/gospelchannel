# Plan 008: Harden JSON-LD output and fix structured-data correctness bugs

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7508bb95..HEAD -- src/lib/json-ld.ts src/components/ChurchProofRouteLandingPage.tsx src/components/ChurchCollectionPage.tsx "src/app/church/[slug]/page.tsx" src/app/church/churches-with-service-times src/app/church/churches-with-worship-music src/app/church/english-speaking-churches src/app/church/family-friendly-churches`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> **Branch note**: this plan was written against the working tree of branch
> `geo-seo-decision-engine`, which contains UNCOMMITTED files (the four proof
> routes and `ChurchProofRouteLandingPage.tsx` are new/untracked at commit
> `7508bb95`). If those files are absent, STOP — the branch state has changed.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: security + bug + perf
- **Planned at**: commit `7508bb95` (branch `geo-seo-decision-engine`, uncommitted work included), 2026-07-07

## Why this matters

Every `<script type="application/ld+json">` block in the app is filled with raw
`JSON.stringify(...)`. `JSON.stringify` does not escape `<`, so a church name or
description containing `</script><img src=x onerror=...>` closes the script tag
and executes attacker HTML — church names are ingested from Google Places
imports and the public `/church/suggest` form, i.e. they are not trusted input.
This is a stored-XSS vector across ~32 pages.

Additionally three structured-data correctness bugs undermine the site's whole
GEO/AI-search strategy on the exact pages built for it: the new proof-route
pages claim `numberOfItems: <thousands>` while enumerating only 48 items
(inconsistent markup that Google can ignore), churches with playlists but zero
cached videos emit an empty `MusicPlaylist` node (`numTracks: 0, track: []`),
and the per-church `BreadcrumbList` is only 2 levels, hiding the
country/city hub hierarchy from crawlers. Finally, all four new proof-route
pages run their uncached database query twice per render (once in
`generateMetadata`, once in the page body) — double Neon load on pages
deliberately built to attract crawler traffic.

## Current state

Relevant files:

- `src/lib/json-ld.ts` — does NOT exist yet; you will create it.
- `src/components/ChurchProofRouteLandingPage.tsx` (untracked, new on this
  branch) — shared landing component for the four proof routes. JSON-LD is
  injected at line 138; `numberOfItems: count` bug at line 105.
- `src/app/church/[slug]/page.tsx` — church detail page. JSON-LD injected at
  line 664. `MusicPlaylist` block at lines 573-583. `BreadcrumbList` at lines
  599-606.
- `src/components/ChurchCollectionPage.tsx` — hub/facet collection pages.
  ItemList schema around line 165; `addressLocality` bug at line 180.
- `src/app/church/churches-with-service-times/page.tsx`,
  `src/app/church/churches-with-worship-music/page.tsx`,
  `src/app/church/english-speaking-churches/page.tsx`,
  `src/app/church/family-friendly-churches/page.tsx` — the four proof routes,
  all with the same `getPageData()` double-fetch shape at lines ~30-57.
- ~28 more files inject JSON-LD the same way; find them all with:
  `grep -rn 'application/ld+json' src --include='*.tsx'`

Excerpt — the injection pattern (`src/components/ChurchProofRouteLandingPage.tsx:138`):

```tsx
<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
```

Excerpt — the `numberOfItems` bug (`src/components/ChurchProofRouteLandingPage.tsx:100-107`):

```ts
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "@id": `${canonicalUrl}#itemlist`,
      name: `${title} ${titleAccent}`,
      numberOfItems: count,                      // <- count is totalCount (can be thousands)
      itemListElement: churches.map((church, index) => ({   // <- only up to 48 items
```

Note: `src/components/ChurchCollectionPage.tsx:165` also has
`numberOfItems: totalCount`, but that one is CORRECT and must NOT be changed —
its list is paginated and its `position` values are global
(`(currentPage - 1) * pageSize + index + 1`, line 168), which is the legitimate
paginated-ItemList pattern. The proof routes have no pagination, so theirs is
wrong.

Excerpt — the empty-MusicPlaylist bug (`src/app/church/[slug]/page.tsx:573-583`):

```ts
    ...(allPlaylists.length > 0 ? [{
      "@context": "https://schema.org",
      "@type": "MusicPlaylist",
      name: `${church.name} Worship Playlist 2026`,
      description: aboutDescription,
      url: pageUrl,
      numTracks: videos.length,          // <- can be 0 when playlists exist but no cached videos
      track: videos.slice(0, 20).map((v) => ({
        "@type": "MusicRecording", name: v.title, url: `https://www.youtube.com/watch?v=${v.videoId}`,
      })),
    }] : []),
```

Excerpt — the flat breadcrumb (`src/app/church/[slug]/page.tsx:599-606`):

```ts
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Churches", item: "https://gospelchannel.com/church" },
        { "@type": "ListItem", position: 2, name: church.name, item: pageUrl },
      ],
    },
```

Context available in the same function scope for deepening it: `church.country`
(string | null), `city` (line 294: `normalizeDisplayText(...) || extractCity(church.location)`),
`church.citySlug`, and `slugify` is already imported (used at line 404:
`/church/country/${slugify(church.country)}`).

Excerpt — the collection addressLocality bug (`src/components/ChurchCollectionPage.tsx:175-184`):

```ts
          ...(church.location || church.country
            ? {
                address: {
                  "@type": "PostalAddress",
                  ...(church.location ? { addressLocality: church.location } : {}),   // <- "City, Country" string stuffed into locality
                  ...(church.country ? { addressCountry: church.country } : {}),
                },
              }
            : {}),
```

`extractCity` (exported from `src/lib/church-directory.ts`, splits "City, Country"
on the comma) is the existing helper for this; the church detail page already
uses it (`src/app/church/[slug]/page.tsx:294`).

Excerpt — the double-fetch shape, identical in all four proof pages
(`src/app/church/churches-with-service-times/page.tsx:30-57`):

```ts
async function getPageData() {
  return getChurchIndexPageData({
    filters: { hasServiceTimes: true },
    page: 1,
    pageSize: PAGE_SIZE,
  });
}

export async function generateMetadata(): Promise<Metadata> {
  const { totalCount } = await getPageData();      // <- fetch #1
  ...
}

export default async function ChurchesWithServiceTimesPage() {
  const { totalCount, pageItems } = await getPageData();   // <- fetch #2, same request
```

`getChurchIndexPageData` (`src/lib/church.ts:1844-1852`) issues uncached SQL to
Neon on every call. React's `cache()` dedupes within one request when the
function identity is shared — that is the fix.

Repo conventions: tests live in `src/lib/__tests__/*.test.ts` using vitest
`describe`/`it`/`expect` (see `src/lib/__tests__/content-quality.test.ts` as the
pattern). No `test` script exists in package.json — run vitest directly.

## Commands you will need

| Purpose   | Command                                     | Expected on success |
|-----------|---------------------------------------------|---------------------|
| Typecheck | `pnpm exec tsc --noEmit`                    | exit 0, no output   |
| Tests     | `pnpm exec vitest run src/lib/__tests__/`   | all pass            |
| Lint      | `pnpm exec eslint src/lib/json-ld.ts`       | exit 0              |

**IMPORTANT**: plain `pnpm typecheck` FAILS in this environment with
`ERR_PNPM_UNSUPPORTED_ENGINE` (repo pins Node 22.x, machine runs Node 26).
Always use the `pnpm exec ...` forms above — they bypass the engine gate and
are verified to work.

## Scope

**In scope** (the only files you should modify or create):

- `src/lib/json-ld.ts` (create)
- `src/lib/__tests__/json-ld.test.ts` (create)
- Every `.tsx` file matched by `grep -rl 'application/ld+json' src --include='*.tsx'`
  (~32 files) — but ONLY the serializer swap inside the
  `dangerouslySetInnerHTML` expression; no other edits in the ~28 files not
  named above.
- `src/components/ChurchProofRouteLandingPage.tsx` (serializer swap + numberOfItems)
- `src/app/church/[slug]/page.tsx` (serializer swap + MusicPlaylist gate + breadcrumbs)
- `src/components/ChurchCollectionPage.tsx` (serializer swap + addressLocality)
- The four proof-route `page.tsx` files (cache() wrap)

**Out of scope** (do NOT touch, even though they look related):

- `src/components/ChurchCollectionPage.tsx` `numberOfItems: totalCount` — correct
  paginated pattern, leave it.
- `src/lib/seo-schema.ts` — schema builders are fine; plan 009 extends them.
- `src/app/llms.txt`, `src/lib/agent-discovery.ts` and other in-flight GEO files.
- Any change to what data the schemas CONTAIN (that is plan 009) — this plan
  only fixes how they are serialized and the four named bugs.
- `worker.ts` (the response-buffering finding is deferred, see plans/README.md).

## Git workflow

- Branch: work directly on `geo-seo-decision-engine` (the in-scope proof-route
  files are uncommitted there; a new branch would strand them).
- Commit style: conventional commits matching `git log`, e.g.
  `fix(seo): escape JSON-LD serialization to block script-tag breakout`.
- Do NOT push or deploy unless the operator instructed it.

## Steps

### Step 1: Create the safe serializer

Create `src/lib/json-ld.ts`:

```ts
/**
 * Serialize a value for embedding inside <script type="application/ld+json">.
 * JSON.stringify alone is unsafe there: it does not escape "<", so a value
 * containing "</script>" closes the tag and injects HTML. Escaping "<" as
 * the JSON unicode escape \u003c neutralizes the breakout. U+2028/U+2029
 * are escaped for JS-context safety as well.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
```

Create `src/lib/__tests__/json-ld.test.ts` (model after
`src/lib/__tests__/content-quality.test.ts`) covering:

1. Plain object round-trips: `JSON.parse(serializeJsonLd(x))` deep-equals `x`.
2. Breakout neutralized: `serializeJsonLd({ name: "</script><img>" })` contains
   no literal `<` character.
3. Round-trip preserves the malicious string exactly (escaping, not stripping).

**Verify**: `pnpm exec vitest run src/lib/__tests__/json-ld.test.ts` → 3 tests pass.

### Step 2: Swap every injection site to the serializer

List all sites: `grep -rn 'application/ld+json' src --include='*.tsx'`
(expect ~32 matches). In each, change the `dangerouslySetInnerHTML` expression
from `JSON.stringify(<expr>)` to `serializeJsonLd(<expr>)` and add
`import { serializeJsonLd } from "@/lib/json-ld";` to the file's imports
(match the existing `@/lib/...` import style in each file). Make NO other
change in these files (except those named in later steps).

`src/app/layout.tsx` has the injection inside a `<script id="site-schema">`
block around line 105-109 — same swap applies.

**Verify**:
- `grep -rn 'application/ld+json' src --include='*.tsx' | wc -l` → same count as before the step.
- `grep -rn '__html: JSON.stringify' src --include='*.tsx'` → **0 matches**.
- `pnpm exec tsc --noEmit` → exit 0.

### Step 3: Fix `numberOfItems` on the proof-route ItemList

In `src/components/ChurchProofRouteLandingPage.tsx` line 105, change
`numberOfItems: count` to `numberOfItems: churches.length`. Do not remove the
`count` prop — it is still used in prose/hero copy.

**Verify**: `grep -n 'numberOfItems' src/components/ChurchProofRouteLandingPage.tsx`
→ shows `churches.length`; `pnpm exec tsc --noEmit` → exit 0.

### Step 4: Gate the MusicPlaylist node on actual tracks

In `src/app/church/[slug]/page.tsx` line 573, change the guard from
`allPlaylists.length > 0` to `allPlaylists.length > 0 && videos.length > 0`
so churches with playlists but zero cached videos emit no empty
`MusicPlaylist` node.

**Verify**: `sed -n '573p' "src/app/church/[slug]/page.tsx"` → shows the
combined guard; `pnpm exec tsc --noEmit` → exit 0.

### Step 5: Deepen the church BreadcrumbList

Replace the 2-level breadcrumb (lines 599-606 of
`src/app/church/[slug]/page.tsx`) with a dynamically positioned list that
inserts country and city crumbs when available:

```ts
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { name: "Churches", item: "https://gospelchannel.com/church" },
        ...(church.country
          ? [{ name: church.country, item: `https://gospelchannel.com/church/country/${slugify(church.country)}` }]
          : []),
        ...(city && church.citySlug
          ? [{ name: city, item: `https://gospelchannel.com/church/city/${church.citySlug}` }]
          : []),
        { name: church.name, item: pageUrl },
      ].map((crumb, index) => ({ "@type": "ListItem", position: index + 1, ...crumb })),
    },
```

`slugify` and `city` are already in scope (see Current state).

**Verify**: `pnpm exec tsc --noEmit` → exit 0. Then run the existing page tests:
`pnpm exec vitest run src/lib/__tests__/church-page.test.ts` → all pass.

### Step 6: Fix addressLocality on collection pages

In `src/components/ChurchCollectionPage.tsx` (~line 180), split the combined
location string: import `extractCity` from `@/lib/church-directory` and use it
in place of the raw `church.location` for `addressLocality`. Keep
`addressCountry: church.country` as is. If `extractCity(church.location)`
returns a falsy value, omit `addressLocality` entirely.

**Verify**: `pnpm exec tsc --noEmit` → exit 0;
`pnpm exec vitest run src/lib/__tests__/church-directory.test.ts` → all pass.

### Step 7: Deduplicate the proof-route page fetch

In each of the four proof-route pages
(`churches-with-service-times`, `churches-with-worship-music`,
`english-speaking-churches`, `family-friendly-churches` under
`src/app/church/`), wrap `getPageData` in React `cache()`:

```ts
import { cache } from "react";

const getPageData = cache(async () =>
  getChurchIndexPageData({
    filters: { hasServiceTimes: true },   // keep each page's own filters unchanged
    page: 1,
    pageSize: PAGE_SIZE,
  })
);
```

(Convert the `async function getPageData()` declaration to the const form;
keep each page's existing filter object exactly as it is.)

**Verify**:
- `grep -ln 'cache(' src/app/church/churches-with-service-times/page.tsx src/app/church/churches-with-worship-music/page.tsx src/app/church/english-speaking-churches/page.tsx src/app/church/family-friendly-churches/page.tsx | wc -l` → `4`.
- `pnpm exec tsc --noEmit` → exit 0.

## Test plan

- New: `src/lib/__tests__/json-ld.test.ts` — 3 cases listed in Step 1.
- Existing suites that must stay green (they cover the touched surfaces):
  `pnpm exec vitest run src/lib/__tests__/` → all pass, including
  `church-page.test.ts`, `church-directory.test.ts`, `seo-schema.test.ts`,
  `church-metadata.test.ts`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm exec tsc --noEmit` exits 0
- [ ] `pnpm exec vitest run src/lib/__tests__/` exits 0; `json-ld.test.ts` exists with 3 passing tests
- [ ] `grep -rn '__html: JSON.stringify' src --include='*.tsx'` → 0 matches
- [ ] `grep -rn 'serializeJsonLd' src --include='*.tsx' | wc -l` ≥ 30
- [ ] `numberOfItems: churches.length` present in `ChurchProofRouteLandingPage.tsx`; `numberOfItems: totalCount` still present in `ChurchCollectionPage.tsx`
- [ ] All four proof pages import `cache` from `react`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `ChurchProofRouteLandingPage.tsx` or the four proof-route directories do not
  exist (the uncommitted branch work was reverted or committed differently).
- The grep in Step 2 matches a site where the injected value is NOT produced
  by `JSON.stringify` (e.g. a pre-built string) — list those sites instead of
  guessing.
- Any existing test in `src/lib/__tests__/` fails BEFORE your changes
  (baseline is broken — report, don't fix unrelated tests).
- You find yourself wanting to change what data a schema contains (rating,
  opening hours, sameAs, etc.) — that is plan 009, not this plan.

## Maintenance notes

- Plan 009 edits the same `jsonLd` blocks in `src/app/church/[slug]/page.tsx`
  and assumes `serializeJsonLd` exists — land this plan first.
- Any future page that adds JSON-LD must use `serializeJsonLd`; a reviewer
  should reject new `__html: JSON.stringify` occurrences (consider adding an
  ESLint rule later — deferred).
- The worker.ts full-response buffering (PERF finding) was deliberately left
  out: MED risk for uncertain gain; revisit if TTFB becomes a complaint.
