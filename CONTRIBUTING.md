# Contributing to GospelChannel

Thanks for taking the time to help.

This is a solo-maintained project, and my first open source project. Suggestions and pull requests are welcome, but scope and final direction stay with the maintainer.

Please keep things simple and explicit. Small issues, small PRs, and plain-language explanations are the easiest for me to review well.

## Good contributions

- Bug fixes
- Small UI polish
- Accessibility improvements
- Performance improvements
- Documentation fixes
- Focused features that fit the current product direction

## Before you start

- For anything non-trivial, open an issue first so we can confirm fit
- English or Swedish is fine
- Prefer one pull request per change

## Local checklist

```bash
nvm use
npm install
cp .env.example .env.local
npm run lint
npm run build
```

If your change affects UI, include screenshots or a short screen recording in the pull request.

## Pull request notes

- Explain the problem and the fix
- Keep changes focused
- Avoid unrelated refactors unless they are required for the fix
- Update docs when behavior changes
- Note any environment-variable or deployment impact

## Changes that are less likely to merge

- Large rewrites without prior discussion
- New dependencies without a clear payoff
- Cleanup-only refactors bundled into feature work

If you are unsure whether something is a good fit, open an issue first. That is the easiest path.
