# Plan 009: Surface ratings, service hours, socials, pastor and livestream in structured data

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7508bb95..HEAD -- src/lib/church.ts src/types/gospel.ts src/lib/seo-schema.ts "src/app/church/[slug]/page.tsx"`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. Exception: changes from plan 008
> (serializeJsonLd swap, breadcrumb deepening, MusicPlaylist gate) are
> EXPECTED in `src/app/church/[slug]/page.tsx` — this plan depends on 008.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (additive; one MED-risk rule: ratings must be visible on-page, handled in Step 3)
- **Depends on**: plans/008-jsonld-hardening-and-schema-fixes.md
- **Category**: seo / direction
- **Planned at**: commit `7508bb95` (branch `geo-seo-decision-engine`), 2026-07-07

## Why this matters

The site's strategy is to be what AI search engines and Google cite for church
discovery. The database already holds the exact fields such engines need, but
none of them reach the page's structured data:

- `google_rating` + `google_reviews_count` exist for ~14,000 churches in the
  `church_enrichments` table but appear ZERO times in `src/` — not in any
  query, type, UI element, or schema. Star ratings are the strongest
  rich-result and citation-trust signal a local entity page can emit.
- Weekly service times exist for ~20,700 churches as structured
  `{day, time}` data and render in the UI, but the JSON-LD only ever emits a
  bare duration — "what time is the service at X", the single most common
  church query, is invisible to machines.
- Per-church YouTube/Instagram/Facebook URLs are resolved on the page but never
  emitted as `sameAs`, the canonical entity-disambiguation signal.
- Pastor name/title (11,600 churches) and livestream URL (17,100 churches)
  render as plain text/links but have no schema representation.

## Current state

Relevant files:

- `src/lib/church.ts` — `getChurchEnrichment` around lines 517-640: an inline
  `ChurchEnrichmentRow` type, a PostgREST-style `.select("*")` fetch, and a
  hand-written row→camelCase mapping. Because it selects `*`, the rating
  columns already come back from the DB — they are simply not declared in the
  row type nor mapped.
- `src/types/gospel.ts` — `ChurchEnrichment` type (fields around lines
  240-292); `ServiceTime` type at line 195:
  `{ day: string; time: string; label?: string }`.
- `src/lib/seo-schema.ts` — small pure schema-builder module (166 lines,
  exports `buildArticleSchema`, `buildBreadcrumbSchema`, `buildItemListSchema`
  etc.). New pure builders go here; it has a test file
  `src/lib/__tests__/seo-schema.test.ts` (new on this branch).
- `src/app/church/[slug]/page.tsx` — the church detail page. The Church
  JSON-LD node is at lines ~535-572 (after plan 008: same block, serialized via
  `serializeJsonLd`). Social URLs are resolved at lines 328-351 into
  `socialLinks` (`{ platform, url, icon }[]`). `pastorName`/`pastorTitle` at
  lines 353-354. `livestreamUrl` at lines 355-357. `serviceTimes` (sanitized
  `ServiceTime[]`) at line 289. The visible evidence row
  `profileEvidenceSignals` is built at lines 436-467 from
  `{ key, label, value, href? }` entries.

Excerpt — the DB columns exist but stop at the row type
(`src/lib/church.ts:544-548` area; the row type declares neighbors of the
missing fields):

```ts
    social_stats_fetched_at: string | null;
    children_ministry: boolean | null;
    ...
    visitor_faq: ChurchEnrichment["visitorFaq"] | null;
```

(No `google_rating`, `google_reviews_count`, `google_place_id`, or `amenities`
anywhere in the type or the mapping below it. The DB table has all four —
verified via information_schema on 2026-07-07. Rating values were harvested
from Google Places in the June-July 2026 backfills.)

Excerpt — the mapping that must gain two fields (`src/lib/church.ts:585-590` area):

```ts
  const verified = row.enrichment_status === "complete";
  return {
    id: row.id,
    churchSlug: row.church_slug ?? undefined,
    ...
```

Ratings/review counts are FACTS from Google Places (like address/phone), not
AI-generated prose — so they must NOT be gated behind `verified`. Follow the
placement of `latitude`/`phone` (ungated), not `summary`/`pastorName` (gated).
Note: `pastorName` IS verification-gated in this mapping
(`pastorName: verified ? (row.pastor_name ?? undefined) : undefined`) — Step 6
inherits that gating automatically by reading the mapped value.

Excerpt — the Church JSON-LD node today (`src/app/church/[slug]/page.tsx:535-572`,
abridged):

```ts
    {
      "@context": "https://schema.org",
      "@type": "Church",
      name: displayName,
      ...(websiteUrl && { url: websiteUrl }),
      ...(streetAddress && { address: { ... } }),
      ...(enrichment?.latitude && enrichment?.longitude && {
        geo: { "@type": "GeoCoordinates", latitude: enrichment.latitude, longitude: enrichment.longitude },
      }),
      ...(mapsHref && { hasMap: mapsHref }),
      ...(phone && { telephone: phone }),
      ...(serviceDurationMinutes && { eventSchedule: { "@type": "Schedule", duration: `PT${serviceDurationMinutes}M` } }),
      ...(goodFitTags && goodFitTags.length > 0 && { keywords: goodFitTags.join(", ") }),
    },
```

Excerpt — the visible evidence-signal pattern to copy for the rating chip
(`src/app/church/[slug]/page.tsx:440-442`):

```ts
    serviceTimeLabel
      ? { key: "service-times", label: "Sunday timing", value: serviceTimeLabel, href: "#your-first-sunday" }
      : null,
```

Repo conventions: pure schema builders live in `src/lib/seo-schema.ts` with
tests in `src/lib/__tests__/seo-schema.test.ts`; vitest `describe`/`it`.

## Commands you will need

| Purpose   | Command                                     | Expected on success |
|-----------|---------------------------------------------|---------------------|
| Typecheck | `pnpm exec tsc --noEmit`                    | exit 0, no output   |
| Tests     | `pnpm exec vitest run src/lib/__tests__/`   | all pass            |

**IMPORTANT**: plain `pnpm typecheck` fails in this environment
(`ERR_PNPM_UNSUPPORTED_ENGINE`, Node 26 vs pinned 22). Use `pnpm exec` forms.

## Scope

**In scope** (the only files you should modify):

- `src/lib/church.ts` (row type + mapping additions only)
- `src/types/gospel.ts` (ChurchEnrichment additions only)
- `src/lib/seo-schema.ts` (new builder: `buildOpeningHours`)
- `src/lib/__tests__/seo-schema.test.ts` (new tests)
- `src/app/church/[slug]/page.tsx` (Church JSON-LD node + one evidence signal)

**Out of scope** (do NOT touch):

- Brand-level `sameAs` in `src/app/layout.tsx` — GospelChannel has no
  confirmed own social profiles (checked SiteFooter/layout on 2026-07-07:
  none). Do not invent URLs.
- `src/app/preview/[slug]/page.tsx`, collection/proof-route schema — church
  detail page only in this plan.
- Any crawling/backfill script; this plan surfaces existing data only.
- The `amenities`/`google_place_id` columns — deliberately not surfaced yet.

## Git workflow

- Branch: work directly on `geo-seo-decision-engine`.
- Commit style: conventional commits, e.g.
  `feat(seo): emit aggregateRating and opening hours in church schema`.
- Do NOT push or deploy unless the operator instructed it.

## Steps

### Step 1: Plumb the rating fields through the data layer

1. In `src/lib/church.ts`, add to the inline `ChurchEnrichmentRow` type:
   ```ts
   google_rating: number | null;
   google_reviews_count: number | null;
   ```
2. In the return mapping of the same function (ungated section, next to
   `latitude`/`phone`):
   ```ts
   googleRating: typeof row.google_rating === "number" ? row.google_rating : undefined,
   googleReviewsCount: typeof row.google_reviews_count === "number" ? row.google_reviews_count : undefined,
   ```
   (The defensive `typeof` check matters: the value arrives through a JSON
   layer; if the DB driver returns it as a string, see STOP conditions.)
3. In `src/types/gospel.ts`, add to `ChurchEnrichment` (near the social-stats
   fields):
   ```ts
   /** Google Places rating, 1.0-5.0, harvested from Places data. Factual, not AI-generated. */
   googleRating?: number;
   googleReviewsCount?: number;
   ```

**Verify**: `pnpm exec tsc --noEmit` → exit 0.

Then verify the data actually flows: run this one-off (uses the repo's env)
```
node -e "
import('@neondatabase/serverless').then(async ({ neon }) => {
  const { loadEnvConfig } = (await import('@next/env')).default;
  loadEnvConfig(process.cwd());
  const sql = neon(process.env.DATABASE_URL);
  const r = await sql\`SELECT google_rating, google_reviews_count FROM church_enrichments WHERE google_rating IS NOT NULL LIMIT 3\`;
  console.log(r);
});"
```
→ prints 3 rows with numeric `google_rating` (e.g. `4.8`) and integer
`google_reviews_count`. If values print as strings (e.g. `'4.8'`), adjust the
mapping in item 2 to `Number(row.google_rating)` with an `Number.isFinite`
guard, and note it in your report.

### Step 2: Add the `buildOpeningHours` schema builder

In `src/lib/seo-schema.ts`, add:

```ts
const DAY_OF_WEEK: Record<string, string> = {
  sunday: "https://schema.org/Sunday",
  monday: "https://schema.org/Monday",
  tuesday: "https://schema.org/Tuesday",
  wednesday: "https://schema.org/Wednesday",
  thursday: "https://schema.org/Thursday",
  friday: "https://schema.org/Friday",
  saturday: "https://schema.org/Saturday",
};

export type OpeningHoursInput = { day: string; time: string };

/**
 * Map service times ({day, time} strings) to schema.org
 * openingHoursSpecification entries. Only entries whose day matches an
 * English weekday (singular or plural, any case) AND whose time parses to
 * HH:MM (12h with am/pm, or 24h) are emitted; everything else is skipped —
 * partial data beats malformed markup.
 */
export function buildOpeningHours(times: OpeningHoursInput[]): {
  "@type": "OpeningHoursSpecification";
  dayOfWeek: string;
  opens: string;
}[] {
  const out: { "@type": "OpeningHoursSpecification"; dayOfWeek: string; opens: string }[] = [];
  for (const entry of times) {
    const dayKey = entry.day.trim().toLowerCase().replace(/s$/, "");
    const dayOfWeek = DAY_OF_WEEK[dayKey];
    if (!dayOfWeek) continue;
    const match = entry.time.trim().match(/^(\d{1,2})[:.](\d{2})\s*(am|pm)?$/i);
    if (!match) continue;
    let hours = Number(match[1]);
    const minutes = match[2];
    const meridiem = match[3]?.toLowerCase();
    if (meridiem === "pm" && hours < 12) hours += 12;
    if (meridiem === "am" && hours === 12) hours = 0;
    if (hours > 23 || Number(minutes) > 59) continue;
    out.push({
      "@type": "OpeningHoursSpecification",
      dayOfWeek,
      opens: `${String(hours).padStart(2, "0")}:${minutes}`,
    });
  }
  return out;
}
```

Add tests in `src/lib/__tests__/seo-schema.test.ts` (append to the existing
file, matching its style):

1. `"Sunday" + "10:00 AM"` → one entry, `dayOfWeek` ends `/Sunday`, `opens === "10:00"`.
2. `"Sundays" + "4:30 pm"` → `opens === "16:30"` (plural day, pm conversion).
3. `"12:00 am"` → `opens === "00:00"`; `"12:15 PM"` → `"12:15"`.
4. Garbage day (`"Weekly"`) or garbage time (`"morning"`) → skipped, empty array.
5. Mixed valid+invalid input → only valid entries returned, order preserved.

**Verify**: `pnpm exec vitest run src/lib/__tests__/seo-schema.test.ts` → all pass (old + 5 new).

### Step 3: Emit aggregateRating + visible rating chip

In `src/app/church/[slug]/page.tsx`:

1. Near the other enrichment destructures (around line 353), add:
   ```ts
   const googleRating = enrichment?.googleRating;
   const googleReviewsCount = enrichment?.googleReviewsCount;
   const showGoogleRating = Boolean(
     googleRating && googleRating >= 1 && googleRating <= 5 && googleReviewsCount && googleReviewsCount >= 3
   );
   ```
   (Minimum 3 reviews: a 5.0 from one review is noise and looks gamed.)
2. In the Church JSON-LD node (lines ~535-572), add alongside `telephone`:
   ```ts
   ...(showGoogleRating && {
     aggregateRating: {
       "@type": "AggregateRating",
       ratingValue: googleRating,
       reviewCount: googleReviewsCount,
       bestRating: 5,
       worstRating: 1,
     },
   }),
   ```
3. **Required pairing** (Google penalizes schema-only ratings): add a visible
   evidence signal to the `profileEvidenceSignals` array (lines 436-467),
   after the `location` entry, following the existing pattern:
   ```ts
   showGoogleRating
     ? { key: "google-rating", label: "Google rating", value: `${googleRating!.toFixed(1)} of 5 (${googleReviewsCount!.toLocaleString("en-US")} Google reviews)`, href: mapsHref }
     : null,
   ```

**Verify**: `pnpm exec tsc --noEmit` → exit 0;
`pnpm exec vitest run src/lib/__tests__/church-page.test.ts` → all pass.

### Step 4: Emit openingHoursSpecification from service times

In the same Church JSON-LD node, add (importing `buildOpeningHours` from
`@/lib/seo-schema`):

```ts
...(serviceTimes.length > 0 && (() => {
  const openingHours = buildOpeningHours(serviceTimes);
  return openingHours.length > 0 ? { openingHoursSpecification: openingHours } : {};
})()),
```

(`serviceTimes` is the already-sanitized array from line 289. Keep the
existing `eventSchedule` duration emit untouched — they complement each other.)

**Verify**: `pnpm exec tsc --noEmit` → exit 0.

### Step 5: Emit sameAs from the resolved social links

In the same Church JSON-LD node, add:

```ts
...(socialLinks.length > 0 && { sameAs: socialLinks.map((link) => link.url) }),
```

(`socialLinks` is built at lines 348-351 from already-validated URLs.)

**Verify**: `pnpm exec tsc --noEmit` → exit 0.

### Step 6: Emit pastor and livestream

In the same Church JSON-LD node, add:

```ts
...(pastorName && {
  employee: {
    "@type": "Person",
    name: pastorName,
    ...(pastorTitle && { jobTitle: pastorTitle }),
  },
}),
...(livestreamUrl && {
  potentialAction: {
    "@type": "WatchAction",
    target: livestreamUrl,
    name: "Watch the Sunday service online",
  },
}),
```

(`pastorName` is already verification-gated upstream in the enrichment mapping,
so unverified AI-extracted pastor names cannot leak into schema. `livestreamUrl`
passed `isValidPublicUrl` at line 355.)

**Verify**: `pnpm exec tsc --noEmit` → exit 0.

### Step 7: Full regression pass

**Verify**:
- `pnpm exec vitest run src/lib/__tests__/` → all suites pass.
- Sanity-render one page locally if a dev server is available
  (`pnpm exec next dev` may fail on the Node-version gate; if it does, skip
  the manual render and note it — the unit gates above are the requirement).

## Test plan

- New: 5 `buildOpeningHours` cases in `src/lib/__tests__/seo-schema.test.ts`
  (Step 2). Model after the file's existing tests.
- Existing suites stay green: `church-page.test.ts`, `seo-schema.test.ts`,
  `church-metadata.test.ts`, full `src/lib/__tests__/` run.
- No new test infrastructure; the JSON-LD content of the page component is
  covered indirectly by typecheck + the builder's unit tests (the page has no
  render-test harness — do not build one for this plan).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm exec tsc --noEmit` exits 0
- [ ] `pnpm exec vitest run src/lib/__tests__/` exits 0, including ≥5 new opening-hours tests
- [ ] `grep -n "googleRating" src/lib/church.ts src/types/gospel.ts "src/app/church/[slug]/page.tsx" | wc -l` ≥ 4
- [ ] `grep -n "aggregateRating" "src/app/church/[slug]/page.tsx"` → 1 match
- [ ] `grep -n "openingHoursSpecification" "src/app/church/[slug]/page.tsx"` → ≥1 match
- [ ] `grep -n "sameAs" "src/app/church/[slug]/page.tsx"` → ≥1 match
- [ ] The rating is VISIBLE on-page (evidence signal added), not schema-only
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 008 has not landed (no `serializeJsonLd` in
  `src/app/church/[slug]/page.tsx`) — execute 008 first.
- The Step 1 data probe returns zero rows with non-null `google_rating`
  (the backfill assumption is false).
- The Step 1 data probe returns ratings outside 1-5 or obviously bogus values
  — report samples instead of shipping them into schema.
- `getChurchEnrichment` in `src/lib/church.ts` no longer uses the
  `.select("*")` PostgREST-style fetch (a refactor landed) — the plumbing
  approach must be re-planned, not improvised.
- Adding the fields requires touching the Drizzle schema
  (`src/db/schema/gospel.ts`) to make typecheck pass — that file is not in
  scope; report instead.

## Maintenance notes

- If a future crawl refreshes `google_rating`, nothing here changes — the page
  reads whatever is in the row.
- Reviewer should scrutinize: (a) the rating is not verification-gated (correct
  — it's factual), (b) the visible chip and the schema always appear together,
  (c) `buildOpeningHours` silently skips unparseable rows — spot-check a few
  churches with non-English day strings (German/Spanish imports) and confirm
  they emit nothing rather than garbage.
- Deferred follow-ups (out of this plan): localized day-name parsing for EU
  service times; `inLanguage` per church from the language field; video
  sitemap (Worker CPU risk — see plans/README.md rejected/deferred notes).
