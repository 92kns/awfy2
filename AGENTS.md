# AWFY Reimagined agent guide

## Purpose

AWFY Reimagined is a static, configuration-driven Firefox performance dashboard. It is
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
- Pass `AbortSignal` through all network operations, and never surface an abort
  as a failure.
- Deterministic unit tests must not depend on live Treeherder availability.
- Preserve partial successes when one configured series fails.
- Keep Vite assets relative so both GitHub Pages and the perf-labs proxy work.
- Treeherder is shared production infrastructure: coalesce signature ids into
  batched requests and keep the in-flight limit in `treeherder/client.ts`.
- Enrichment (alerts, repository catalogue) must never fail primary data, and
  must degrade visibly: return a warning on `SeriesQuerySuccess.warnings` so the
  diagnostics banner can say the graph is unannotated. Key warnings by cause, not
  by series, so one shared outage reports once.
- Only fetch-relevant selection state may restart loading; presentation state
  such as chart mode, baseline, or series visibility must not refetch.
- A displayed comparison must be a comparison that actually happened: no
  absolute values under a percentage axis, no delta without a nearby sample.

## Commands

```sh
npm run check
npm test
npm run build
npm run verify:dist
npm run format:check
npm run test:e2e
npm run audit:live
```

Run the first five before committing. Playwright requires an installed browser.
`audit:live` needs network access and compares live signature resolution with
`scripts/audit-baseline.txt`; refresh that file with
`npm run audit:live -- --update-baseline` only for deliberate preset changes.
