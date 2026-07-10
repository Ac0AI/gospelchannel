# Task 2 Report: Guides, Audiences, And Search Discovery

## Scope Delivered

- Extended `PUBLIC_COPY_GROUPS` with the required `guidesAndAudiences` source list.
- Replaced internal visitor-facing terminology across guide pages, audience pages, shared guide components, quiz copy, structured data, guide data, and search suggestions.
- Updated the church-choice guide hero to `Church choice guide` and `Find the church that fits your life` with an intro covering worship style, denomination, location, language, service times, and first-visit concerns.
- Updated its summary to `Start with what matters most.` and added the required `Read the guide` and `Explore churches` links.
- Rewrote search subtitles as direct destinations, including `Find churches with published service times.` and `Explore English-speaking churches.`

## Contract Preservation

- Kept all existing `guide`, `proof`, and `proof_routes` keys and href values unchanged.
- Kept guide-to-church mappings, sitemap inputs, and search suggestion types unchanged.
- Kept agent-discovery output unchanged. `src/lib/agent-discovery.ts` translates the two new visitor labels back to its established machine-facing evidence labels at serialization time; no agent-discovery tests were changed.

## TDD Record

1. Added the `guidesAndAudiences` public-copy group.
2. Ran `pnpm --config.engine-strict=false vitest run src/lib/__tests__/public-copy.test.ts` and confirmed the expected red failure from visitor-facing internal terminology in `src/app/for/page.tsx`.
3. Added exact destination subtitle assertions for service-time and English-speaking church search suggestions.
4. Implemented the smallest contextual copy changes needed for the guard and behavior tests.
5. Ran the required focused suite until all tests passed.

## Verification

Required test command:

```sh
pnpm --config.engine-strict=false vitest run src/lib/__tests__/public-copy.test.ts src/lib/__tests__/church-choice-answers.test.ts src/lib/__tests__/for-audience-data.test.ts src/lib/__tests__/search-suggestions.test.ts src/lib/__tests__/seo-schema.test.ts src/lib/__tests__/sitemap-data.test.ts src/lib/__tests__/agent-discovery.test.ts
```

Result: 7 test files passed, 34 tests passed.

Additional review:

- `git diff --check` passed.
- Confirmed no changed `href` values in `src/lib/church-choice-answers.ts` or `src/lib/for-audience-data.ts`.
- Confirmed no forbidden internal copy matches remain in the `guidesAndAudiences` guard scope.

## Notes

- The test command emits the pre-existing environment warnings for the Node engine (`22.x` requested, `26.3.0` running) and Node's `module.register()` deprecation. The test suite still completes successfully.
- `.agents/` was left unmodified and unstaged.
