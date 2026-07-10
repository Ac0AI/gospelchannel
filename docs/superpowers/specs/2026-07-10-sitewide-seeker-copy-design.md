# Sitewide Seeker Copy Design

**Date:** 2026-07-10
**Status:** Approved direction

## Goal

Rewrite GospelChannel's public-facing copy so it speaks naturally to people looking for a church. Preserve the existing routes, page structure, SEO intent, GEO discovery, and machine-readable data.

The visible experience should help a visitor answer three questions without exposing the site's internal content model:

1. What can I find here?
2. Which option fits what matters to me?
3. What should I open or compare next?

## Problem

Internal product and GEO terminology currently appears in customer-facing text. Phrases such as "proof route", "proof layer", "profile evidence", "decision engine", "decision path", and "answer map" describe how GospelChannel is built rather than how a visitor uses it.

This makes otherwise useful pages sound abstract, procedural, and machine-written.

## Scope

The rewrite covers visible copy across public pages and shared public components, including:

- Homepage and navigation discovery
- Church directory, collection, network, and profile pages
- Guides, comparisons, audience pages, and search suggestions
- Calls to action, labels, introductions, methodology notes, FAQ answers, and empty states
- Public metadata where the same technical language would be visible in search or social previews

The following remain functionally unchanged:

- Routes and link destinations
- Page layouts and component structure
- Filters, data fetching, and ranking behavior
- Structured data types and agent-discovery endpoints
- The underlying guide-to-directory linking model

Machine-readable descriptions may retain precise search concepts when useful, but they must not make visible page copy sound like internal documentation.

## Voice

Use GospelChannel's established seeker voice:

- Plain, warm, and practical
- Helpful without sounding prescriptive
- Specific about what a visitor can inspect before attending
- Neutral across denominations and worship traditions
- Written like guidance from a thoughtful person, not a product architecture diagram

Prefer concrete language such as:

- "See churches with published service times"
- "Listen to worship music before you visit"
- "Compare churches in your city"
- "Check the church profile for language, location, and visitor details"

Avoid visible phrases such as:

- "proof route" or "proof layer"
- "database proof"
- "profile evidence"
- "decision engine" or "decision path"
- "answer map"
- "require evidence"

## Rewrite Rules

### Headlines

Lead with the visitor's goal or uncertainty. A headline should make sense without the surrounding paragraph.

### Body Copy

Explain what the visitor can learn and why it helps. Replace abstract validation language with the actual details available: service times, location, language, worship music, tradition, kids information, videos, and first-visit guidance.

### Calls To Action

Describe the destination or action directly. Use labels such as "Browse churches", "See service times", "Compare denominations", and "Find churches with worship music".

### Labels And Eyebrows

Use familiar categories such as "Find your church", "Before you visit", "Churches to explore", and "What matters to you". Do not label sections according to their role in the SEO architecture.

### Search And GEO Preservation

Keep query-relevant nouns in natural sentences. The rewrite must preserve the page's main entity and intent, but repetition or technical phrasing is not required for SEO or GEO.

Structured data and agent endpoints should continue linking questions, guides, and church collections. Their internal naming does not need to be copied into the visible interface.

## Representative Homepage Rewrite

The homepage decision block will move from internal process language to a visitor-first orientation:

- Eyebrow: "Find your church"
- Heading: "Start with what matters to you."
- Body: explain that visitors can choose worship style, location, tradition, language, or practical Sunday details and then explore matching churches.
- Cards: phrase each option as a natural first-person need and make both links describe their destinations.
- Topic chips: use real visitor concerns rather than content-model labels.

## Verification

1. Search public source files for banned customer-facing phrases and review every remaining match.
2. Update existing tests whose expected copy changes while preserving route and schema assertions.
3. Run the focused GEO/SEO and discovery test suite, typecheck, lint, and production build.
4. Render representative desktop and mobile pages: homepage, church directory, church profile, answer guide, audience hub, comparison hub, and one proof-oriented collection page.
5. Confirm that links, headings, JSON-LD, and search discovery still describe the same entities and destinations.

## Success Criteria

- A visitor can understand each section without knowing GospelChannel's internal strategy.
- No public interface asks users to follow a "route", inspect a "proof layer", or understand a "decision engine".
- Copy remains specific enough to help someone choose the next page or church to inspect.
- Existing SEO/GEO routes, schema relationships, and discovery files continue to pass their tests.
