# AWFY2 agent guide

## Purpose

AWFY2 is a static, configuration-driven Firefox performance dashboard. It is
built for GitHub Pages and embedded by perf-labs. There is deliberately no
application server.

## Architecture boundaries

- `src/domain/` contains framework-independent types and pure transformations.
- `src/treeherder/` is the only layer that knows Treeherder wire formats.
- `src/presets/` contains curated benchmark configuration and pure generators.
- Svelte components consume view models; they must not parse raw API responses.
- URL query parameters are the canonical, shareable application state.

## Invariants

- Runtime-validate every external response.
- Never mutate configuration, signature, option, or datum objects received by a
  function.
- Treat zero and multiple matching signatures as distinct visible outcomes.
- Pass `AbortSignal` through all network operations.
- Deterministic unit tests must not depend on live Treeherder availability.
- Preserve partial successes when one configured series fails.
- Keep Vite assets relative so both GitHub Pages and the perf-labs proxy work.

## Commands

```sh
npm run check
npm test
npm run build
npm run format:check
npm run test:e2e
```

Run the first four before committing. Playwright requires an installed browser.
