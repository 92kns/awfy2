# AWFY2 — Are We Fast Yet?

A greenfield, static Firefox performance dashboard backed by Treeherder. AWFY2
preserves the useful curated views from the legacy Firefox performance
dashboards while making signature resolution, API validation, partial failures,
and shareable state explicit.

## Stack

- Svelte 5
- strict TypeScript
- Vite
- Chart.js
- Zod runtime schemas
- Vitest and Playwright

There is no application server. The production build is suitable for GitHub
Pages and for embedding through the `perf-labs` Netlify proxy.

## Dashboard capabilities

- Compact domain-grouped overview with recent values and largest movers.
- Parent-first benchmark pages with on-demand, searchable subtests.
- Scatter, connected trend, and rolling-median views.
- Absolute and baseline-relative values with higher/lower-is-better semantics.
- Zoom/pan/reset, revision links, and Perfherder alert markers.
- Shareable URL state for every comparison control.
- Runtime-validated Treeherder responses, partial-failure handling, and grouped
  diagnostics.

## Development

Requires Node.js 22.12 or newer.

```sh
npm install
npm run dev
```

Verification:

```sh
npm run check
npm test
npm run build
npm run verify:dist
npm run format:check
npm run audit:live
```

`verify:dist` runs after `build` and asserts that `dist/index.html` references
its bundle relatively. The site is served both from `/awfy2/` on GitHub Pages and
behind a `/gh/awfy2/` proxy prefix, and a root-absolute `/assets/...` URL still
works on a local preview at `/` while 404ing once deployed.

`audit:live` is intentionally separate from deterministic unit tests. It resolves
every curated series against the live Treeherder signature catalogue and
compares the result with `scripts/audit-baseline.txt`.

The baseline records the series that _do_ resolve, plus the current not-found
total and a fingerprint of the exact unresolved set. The presets inherit
thousands of browser/platform combinations Treeherder has never had, so a raw
count of failures cannot tell new breakage from that backlog. The audit fails
when:

- a series in the baseline stops resolving,
- the reviewed not-found set changes—even if additions and removals leave its
  total unchanged,
- a series matches more than one signature, or
- Treeherder returns an invalid response or cannot be reached.

After a deliberate preset or platform-pool change, refresh it:

```sh
npm run audit:live -- --update-baseline
```

For the browser smoke test:

```sh
npx playwright install chromium
npm run test:e2e
```

## Architecture

```text
URL query state
  -> typed AWFY preset
  -> platform/category/benchmark expansion
  -> Treeherder response validation
  -> exact signature resolution
  -> coalesced parent/subtest data fetch, 100 signatures per request
  -> normalized graph view models
  -> Svelte + Chart.js
```

Every series that shares a project, framework, and interval joins one request
batch, and at most six requests are in flight at a time. An overview of the
page-load categories therefore issues a handful of requests instead of one per
configured series.

The important boundaries and invariants are documented in `AGENTS.md`.

## URL state

The dashboard stays at its deployment root and uses query parameters, for
example:

```text
?platform=win11&category=benchmarks&benchmark=overview&days=60
```

This avoids arbitrary-path fallback problems on GitHub Pages and keeps relative
assets working behind the `perf-labs` proxy.

## GitHub Pages

The workflow in `.github/workflows/deploy-pages.yml` verifies and deploys every
push to `main`. In the GitHub repository settings, set Pages source to **GitHub
Actions**.

Vite uses `base: './'`, so the same artifact works at both:

- `https://92kns.github.io/awfy2/`
- `https://perf-labs.netlify.app/` through `/gh/awfy2/`

## Legacy behavior intentionally corrected

- Missing and ambiguous signatures are different error states instead of both
  appearing as empty charts.
- Input arrays are copied before sorting.
- Route changes abort stale requests, and the abort is not reported as an error.
- Successful series remain visible when another series fails.
- Alert enrichment, including its repository lookup, can never fail a graph.
- Perfherder reports `amount_pct` as an unsigned magnitude, so alert direction
  comes from the values the series moved between.
- Invalid and infra alerts are not drawn as product regressions, and alert
  summaries are paginated rather than silently truncated at 100.
- Relative mode never plots absolute values under a percentage axis: a baseline
  that this graph does not contain falls back to the first series.
- Retired and replacement machine pools merge without double-counting a shared
  push, and the merged platforms are named on the card.
- A change is only reported as a mover when a comparison sample actually exists
  near the requested window and the series still reports data.
- Chart points are pointer-only, so the same alerts and pushes are published as
  keyboard-focusable links.
- Y-axis labels use Treeherder's own `measurement_unit` instead of guessing
  milliseconds from the improvement direction.
- Tests exercise the real signature resolver and batching logic rather than a
  mocked copy of the module under test.

## License

MPL-2.0. See `LICENSE`.
