# Sitewide Seeker Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace internal GEO/SEO architecture language across GospelChannel's public interface with plain, useful language for people choosing a church.

**Architecture:** Keep every route, link target, component boundary, data query, and schema relationship intact. Add a source-level public-copy regression test, then rewrite visible copy in four bounded groups: global/home, guides/audiences, directory/profiles, and comparisons/networks. Agent-only discovery content may retain technical terminology because it is not rendered for visitors.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Vitest, Playwright.

## Global Constraints

- Public copy must be plain, warm, practical, neutral across traditions, and specific about what a visitor can do next.
- Public source must not contain the phrases "proof route", "proof layer", "database proof", "profile proof", "profile evidence", "decision engine", "decision path", "answer map", or "require evidence".
- Preserve routes, link destinations, layouts, filters, data fetching, ranking behavior, structured-data types, and agent-discovery endpoints.
- Keep search-relevant terms such as church, city, service times, worship style, denomination, language, kids ministry, and first visit in natural sentences.
- Do not introduce a copy abstraction or runtime dependency for static text.
- Do not modify or stage the unrelated `.agents/` directory.

---

### Task 1: Public Copy Guard And Global Surfaces

**Files:**
- Create: `src/lib/__tests__/public-copy.test.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/about/page.tsx`
- Modify: `src/app/contact/page.tsx`
- Modify: `src/app/for-churches/page.tsx`
- Modify: `src/app/prayerwall/page.tsx`
- Modify: `src/app/prayerwall/[...segments]/page.tsx`
- Modify: `src/components/HomeHero.tsx`
- Modify: `src/components/SiteFooter.tsx`

**Interfaces:**
- Consumes: Existing static copy and existing links in global pages and components.
- Produces: `PUBLIC_COPY_GROUPS`, a test-only map of source groups that later tasks extend.

- [ ] **Step 1: Add the failing global-copy regression test**

Create `src/lib/__tests__/public-copy.test.ts` with the global file group and exact forbidden patterns:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const FORBIDDEN_PUBLIC_COPY = [
  /\bproof routes?\b/i,
  /\bproof layer\b/i,
  /\bdatabase proof\b/i,
  /\bprofile (?:proof|evidence)\b/i,
  /\bdecision (?:engine|path)\b/i,
  /\banswer map\b/i,
  /\brequire evidence\b/i,
];

const PUBLIC_COPY_GROUPS: Record<string, string[]> = {
  global: [
    "../../app/page.tsx",
    "../../app/layout.tsx",
    "../../app/about/page.tsx",
    "../../app/contact/page.tsx",
    "../../app/for-churches/page.tsx",
    "../../app/prayerwall/page.tsx",
    "../../app/prayerwall/[...segments]/page.tsx",
    "../../components/HomeHero.tsx",
    "../../components/SiteFooter.tsx",
  ],
};

describe("public copy", () => {
  for (const [group, paths] of Object.entries(PUBLIC_COPY_GROUPS)) {
    it(`${group} uses visitor language instead of internal GEO terminology`, () => {
      for (const path of paths) {
        const source = readFileSync(new URL(path, import.meta.url), "utf8");
        for (const pattern of FORBIDDEN_PUBLIC_COPY) {
          expect(source, `${path} contains ${pattern}`).not.toMatch(pattern);
        }
      }
    });
  }
});
```

- [ ] **Step 2: Run the test and verify the current copy fails**

Run: `pnpm --config.engine-strict=false vitest run src/lib/__tests__/public-copy.test.ts`

Expected: FAIL with matches in `src/app/page.tsx`, `src/app/layout.tsx`, `HomeHero.tsx`, and `SiteFooter.tsx`.

- [ ] **Step 3: Rewrite the homepage and global copy**

Use this exact homepage positioning:

```ts
const HOME_DECISION_PATHS = [
  {
    question: "I'm not sure what kind of church is right for me.",
    answer: "Take the Church Fit Quiz to narrow down what matters, then explore churches that match.",
    guideLabel: "Take the Church Fit Quiz",
    proofLabel: "Browse all churches",
  },
  {
    question: "Worship style matters most to me.",
    answer: "Find the worship style that feels familiar, then listen to music and explore matching churches.",
    guideLabel: "Find my worship style",
    proofLabel: "Churches with worship music",
  },
  {
    question: "I want a church I can visit this Sunday.",
    answer: "Find churches with published service times, then compare location and what each community is like.",
    guideLabel: "Plan my first visit",
    proofLabel: "See Sunday service times",
  },
  {
    question: "Tradition or theology matters to me.",
    answer: "Compare denominations in plain language, then explore churches in that tradition.",
    guideLabel: "Compare denominations",
    proofLabel: "Browse by denomination",
  },
];
```

Set the decision block to:

```tsx
<p className="gc-eyebrow">Find your church</p>
<h2>Start with what matters to you.</h2>
<p>
  Choose the part of church life that matters most right now, from worship style and tradition
  to location, language, and service times. We&apos;ll help you explore churches that fit.
</p>
```

Replace the four internal chips with `worship style`, `location`, `tradition`, and `this Sunday`. Rewrite global metadata and footer text with the same concrete nouns; do not change URLs or JSON-LD types.

- [ ] **Step 4: Run the global-copy test and focused discovery tests**

Run: `pnpm --config.engine-strict=false vitest run src/lib/__tests__/public-copy.test.ts src/lib/__tests__/site-discovery.test.ts src/lib/__tests__/seo-schema.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the global copy group**

```bash
git add src/app/page.tsx src/app/layout.tsx src/app/about/page.tsx src/app/contact/page.tsx src/app/for-churches/page.tsx src/app/prayerwall/page.tsx 'src/app/prayerwall/[...segments]/page.tsx' src/components/HomeHero.tsx src/components/SiteFooter.tsx src/lib/__tests__/public-copy.test.ts
git commit -m "fix(copy): make global church search language visitor-first"
```

### Task 2: Guides, Audiences, And Search Discovery

**Files:**
- Modify: `src/lib/__tests__/public-copy.test.ts`
- Modify: `src/app/for/page.tsx`
- Modify: `src/app/for/[slug]/page.tsx`
- Modify: `src/app/guides/page.tsx`
- Modify: `src/app/guides/church-choice-answers/page.tsx`
- Modify: `src/app/guides/church-fit-quiz/page.tsx`
- Modify: `src/app/guides/denominations-comparison/page.tsx`
- Modify: `src/app/guides/first-visit-guide/page.tsx`
- Modify: `src/app/guides/how-to-find-the-right-church/page.tsx`
- Modify: `src/app/guides/prayer-guide/page.tsx`
- Modify: `src/app/guides/worship-styles-explained/page.tsx`
- Modify: `src/components/ForAudienceLayout.tsx`
- Modify: `src/components/guides/GuideChurchEvidence.tsx`
- Modify: `src/components/guides/GuideProofLinks.tsx`
- Modify: `src/components/tools/ChurchFitQuizClient.tsx`
- Modify: `src/lib/church-choice-answers.ts`
- Modify: `src/lib/for-audience-data.ts`
- Modify: `src/lib/search-suggestions.ts`
- Modify: `src/lib/seo-schema.ts`
- Modify: `src/lib/tooling.ts`
- Test: `src/lib/__tests__/church-choice-answers.test.ts`
- Test: `src/lib/__tests__/search-suggestions.test.ts`
- Test: `src/lib/__tests__/seo-schema.test.ts`

**Interfaces:**
- Consumes: Existing `guide` and `proof` object keys and their hrefs. These internal property names stay unchanged.
- Produces: Visitor-facing labels and descriptions while preserving all guide-to-church route mappings.

- [ ] **Step 1: Extend the copy test with the exact guide and audience files**

Add a `guidesAndAudiences` array to `PUBLIC_COPY_GROUPS` containing every file listed above except test files. Run the copy test and expect failure before editing.

- [ ] **Step 2: Rewrite guide and audience language contextually**

Apply these contextual translations without renaming data interfaces:

| Internal wording | Visible wording |
| --- | --- |
| Answer map | Church choice guide |
| Guide answer | Read the guide |
| Database proof | Explore churches |
| Open proof route | Browse matching churches |
| Profile evidence/proof | Church details |
| Proof signals | What you can check |
| Decision path/engine | A way to find your church |
| Require evidence | Check the practical details |

Set the church-choice guide hero to `Church choice guide`, `Find the church that fits your life`, and an intro that names worship style, denomination, location, language, service times, and first-visit concerns. Set its summary heading to `Start with what matters most.` and its two link labels to `Read the guide` and `Explore churches`.

Keep `item.guide.href`, `item.proof.href`, `proof_routes`, sitemap inclusion, and agent-discovery output unchanged. Rewrite search suggestion subtitles as direct destination descriptions such as `Find churches with published service times` and `Explore English-speaking churches`.

- [ ] **Step 3: Update affected test expectations**

Change visible label and description assertions to the new visitor language. Do not weaken assertions that verify guide routes, church routes, sitemap entries, audience mappings, or JSON-LD relationships. Agent-discovery tests remain unchanged because those endpoints are explicitly machine-facing.

- [ ] **Step 4: Run guide, audience, search, and schema tests**

Run: `pnpm --config.engine-strict=false vitest run src/lib/__tests__/public-copy.test.ts src/lib/__tests__/church-choice-answers.test.ts src/lib/__tests__/for-audience-data.test.ts src/lib/__tests__/search-suggestions.test.ts src/lib/__tests__/seo-schema.test.ts src/lib/__tests__/sitemap-data.test.ts src/lib/__tests__/agent-discovery.test.ts`

Expected: PASS with route assertions unchanged.

- [ ] **Step 5: Commit the guide and audience group**

```bash
git add src/app/for src/app/guides src/components/ForAudienceLayout.tsx src/components/guides src/components/tools/ChurchFitQuizClient.tsx src/lib/church-choice-answers.ts src/lib/for-audience-data.ts src/lib/search-suggestions.ts src/lib/seo-schema.ts src/lib/tooling.ts src/lib/__tests__
git commit -m "fix(copy): rewrite guide and audience language for seekers"
```

### Task 3: Church Directory, Profiles, And Collections

**Files:**
- Modify: `src/lib/__tests__/public-copy.test.ts`
- Modify: `src/app/church/page.tsx`
- Modify: `src/app/church/[slug]/page.tsx`
- Modify: `src/app/church/best-worship-churches/page.tsx`
- Modify: `src/app/church/charismatic-churches-in-london/page.tsx`
- Modify: `src/app/church/churches-with-service-times/page.tsx`
- Modify: `src/app/church/churches-with-worship-music/page.tsx`
- Modify: `src/app/church/english-speaking-churches/page.tsx`
- Modify: `src/app/church/family-friendly-churches/page.tsx`
- Modify: `src/app/church/city/page.tsx`
- Modify: `src/app/church/city/[slug]/page.tsx`
- Modify: `src/app/church/country/page.tsx`
- Modify: `src/app/church/country/[slug]/page.tsx`
- Modify: `src/app/church/denomination/page.tsx`
- Modify: `src/app/church/denomination/[slug]/page.tsx`
- Modify: `src/app/church/style/page.tsx`
- Modify: `src/app/church/style/[slug]/page.tsx`
- Modify: `src/app/church/suggest/page.tsx`
- Modify: `src/components/ChurchCollectionPage.tsx`
- Modify: `src/components/ChurchProofRouteLandingPage.tsx`
- Modify: `src/components/FacetIndexPage.tsx`
- Modify: `src/lib/church-metadata.ts`
- Test: `src/lib/__tests__/church-metadata.test.ts`
- Test: `src/lib/__tests__/church-directory.test.ts`

**Interfaces:**
- Consumes: Existing directory filters, freshness values, church records, and collection-page props.
- Produces: Natural collection metadata, headings, FAQ copy, table labels, and profile guidance.

- [ ] **Step 1: Extend the copy test with the directory file group**

Add every non-test file above under `directoryAndProfiles` in `PUBLIC_COPY_GROUPS`. Run the copy test and expect failure in metadata titles, landing-page text, table headings, and profile guidance.

- [ ] **Step 2: Rewrite directory and profile copy around concrete details**

Use these exact title endings:

- Music-rich profile: `Worship Music, Service Times & Church Details`
- Detailed profile: `Service Times, Worship Style & Church Details`
- City page: `Churches in {city}: Service Times, Worship & Location`
- Country page: `{country} Churches: Cities, Worship Styles & Service Times`
- Denomination page: `{denomination} Churches: Worship, Service Times & Locations`
- Style page: `{style} Churches: Music, Service Times & Locations`

Use `Church details` for profile section eyebrows and table columns. Use `How this list works` for methodology eyebrows. Describe collection pages as lists based on published language, service-time, music, kids/youth, location, or worship data; state `This is not a ranking` where applicable.

Do not change collection queries, ranking formulas, freshness timestamps, canonical URLs, or `ChurchProofRouteLandingPage` component/API names.

- [ ] **Step 3: Update metadata test expectations**

Update `church-metadata.test.ts` expected titles and descriptions from `Profile Proof` to `Church Details`. Rename test descriptions so they describe detailed versus thin profiles without using customer-facing architecture terms.

- [ ] **Step 4: Run directory and metadata tests**

Run: `pnpm --config.engine-strict=false vitest run src/lib/__tests__/public-copy.test.ts src/lib/__tests__/church-metadata.test.ts src/lib/__tests__/church-directory.test.ts src/lib/__tests__/site-discovery.test.ts`

Expected: PASS. Freshness and route assertions remain unchanged.

- [ ] **Step 5: Commit the directory group**

```bash
git add src/app/church src/components/ChurchCollectionPage.tsx src/components/ChurchProofRouteLandingPage.tsx src/components/FacetIndexPage.tsx src/lib/church-metadata.ts src/lib/__tests__/public-copy.test.ts src/lib/__tests__/church-metadata.test.ts
git commit -m "fix(copy): make church directory language concrete"
```

### Task 4: Comparisons, Networks, Alternatives, And Final Source Sweep

**Files:**
- Modify: `src/lib/__tests__/public-copy.test.ts`
- Modify: `src/app/compare/page.tsx`
- Modify: `src/app/compare/[slug]/page.tsx`
- Modify: `src/app/network/page.tsx`
- Modify: `src/app/network/[slug]/page.tsx`
- Modify: `src/app/alternatives/[slug]/page.tsx`
- Modify: `src/app/preview/[slug]/page.tsx`
- Modify: `src/components/AlternativeLayout.tsx`

**Interfaces:**
- Consumes: Existing comparison slugs, network groupings, alternative records, and church links.
- Produces: Visitor-facing comparison and network language with unchanged navigation.

- [ ] **Step 1: Extend the copy test with the remaining public files**

Add the files above under `comparisonsAndNetworks`. Run the copy test and expect failure.

- [ ] **Step 2: Rewrite remaining visible copy**

Use `Churches to explore` for lists after comparisons, `Compare local campuses` for network headings, `Church details` for profile data, and direct CTAs such as `Browse churches in this tradition`, `See local campuses`, and `Open church profile`.

Keep comparison answers, network grouping logic, slugs, canonical URLs, and item-list schema destinations unchanged.

- [ ] **Step 3: Run a repository-wide forbidden-language sweep**

Run:

```bash
rg -n -i "proof route|proof layer|database proof|profile proof|profile evidence|decision engine|decision path|answer map|require evidence" src/app src/components src/lib --glob '!**/__tests__/**' --glob '!agent-discovery.ts'
```

Expected: no matches in public app/components or public-copy library files. Matches are permitted only in explicitly machine-facing `agent-discovery.ts` and its tests.

- [ ] **Step 4: Run all copy-adjacent tests**

Run: `pnpm --config.engine-strict=false vitest run src/lib/__tests__/public-copy.test.ts src/lib/__tests__/church-choice-answers.test.ts src/lib/__tests__/for-audience-data.test.ts src/lib/__tests__/site-discovery.test.ts src/lib/__tests__/search-suggestions.test.ts src/lib/__tests__/sitemap-data.test.ts src/lib/__tests__/seo-schema.test.ts src/lib/__tests__/church-metadata.test.ts src/lib/__tests__/church-directory.test.ts src/lib/__tests__/agent-discovery.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the final public-copy group**

```bash
git add src/app/compare src/app/network src/app/alternatives src/app/preview src/components/AlternativeLayout.tsx src/lib/__tests__/public-copy.test.ts
git commit -m "fix(copy): clarify comparisons and church networks"
```

### Task 5: Build And Browser Verification

**Files:**
- Modify only files with concrete defects found during verification.

**Interfaces:**
- Consumes: Completed visitor-first copy across all public surfaces.
- Produces: Verified production build and representative visual QA evidence.

- [ ] **Step 1: Run static verification**

Run:

```bash
pnpm --config.engine-strict=false typecheck
pnpm --config.engine-strict=false lint
git diff --check
pnpm --config.engine-strict=false build
```

Expected: typecheck, diff check, and build exit 0. Lint has 0 errors; existing script warnings are acceptable.

- [ ] **Step 2: Start the application on an available local port**

Run: `pnpm --config.engine-strict=false dev --port 3045`

Expected: Next.js reports a ready URL. If 3045 is occupied, use the next available port.

- [ ] **Step 3: Inspect representative desktop and mobile routes**

Check these routes at 1440x1000 and 390x844 where relevant:

- `/`
- `/guides/church-choice-answers`
- `/for`
- `/for/new-believers`
- `/church`
- one live `/church/[slug]`
- `/church/churches-with-service-times`
- `/compare`
- `/network`

Expected: no internal GEO terminology is visible, headings fit, CTAs describe their destinations, cards do not overflow, and all tested links navigate correctly.

- [ ] **Step 4: Stop the development server and report residual risks**

Stop the server cleanly. Report any unrelated live-database test failures separately; do not change unrelated data or admin/cron code.
