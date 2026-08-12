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
npm run format:check
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
  -> parent or subtest data fetch in batches of 100
  -> normalized graph view models
  -> Svelte + Chart.js
```

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
- Route changes abort stale requests.
- Successful series remain visible when another series fails.
- Tests exercise the real signature resolver and batching logic rather than a
  mocked copy of the module under test.

## License

MPL-2.0. See `LICENSE`.
