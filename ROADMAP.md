# AWFY2 dashboard evolution plan

This plan keeps AWFY2 a static GitHub Pages application. Treeherder remains
the source of truth; the browser owns selection state and rendering.

## Release objective

Turn the greenfield prototype into an explorable performance dashboard that
answers three questions quickly:

1. What changed?
2. Is that change better or worse?
3. Which push, alert, browser, platform, and subtest explains it?

## Track A: trustworthy data and configuration

- Declare platform applicability in each configured series so impossible
  browser/OS and suite/platform combinations are not requested.
- Preserve migration aliases only when their data contributes to one logical
  series.
- Carry Treeherder revision, push, and job identifiers through runtime-validated
  domain types.
- Fetch runtime-validated Perfherder alert summaries for visible signatures.
- Group diagnostics by actionable cause and deduplicate logical series.
- Run a scheduled live-signature audit that produces a readable CI report.

Acceptance criteria:

- Default overview has no expected Safari-on-Windows or Linux-only-on-Windows
  warnings.
- External responses remain runtime validated and abortable.
- Unit tests remain deterministic; live audits run only in their own workflow.

## Track B: progressive, shareable exploration

- Make parent scores the default for a selected benchmark.
- Fetch subtests only after an explicit action and provide search/filtering.
- Keep project override, chart mode, value mode, baseline, detail mode, and
  series visibility in URL query state.
- Render overview results as compact, grouped benchmark cards instead of dozens
  of full charts.
- Replace raw warning lists with a compact diagnostics disclosure.

Acceptance criteria:

- Speedometer and JetStream initially fetch/render only their parent score.
- Back/forward and shared URLs reproduce the complete comparison state.
- Hundreds of subtests remain usable through search and progressive rendering.

## Track C: analytical charts

- Show latest value, change, freshness, point count, direction, and revision for
  every visible series.
- Support scatter, connected trend, and rolling-median chart modes.
- Support absolute and baseline-relative percentage values.
- Add zoom/pan/reset interaction.
- Open the corresponding Treeherder push when a datum is selected.
- Mark Perfherder alerts and explain regressions/improvements in tooltips.
- Maintain the convention that upward movement means improvement.

Acceptance criteria:

- All transforms are pure and unit tested.
- Chart.js never receives Svelte proxy arrays.
- Interaction works against the production build and remains keyboard-readable.

## Integration and release gates

1. Merge the three tracks at typed domain/view-model boundaries.
2. Run formatting, strict type/Svelte checks, unit tests, production build, and
   Playwright tests.
3. Run the live configuration audit against every curated view.
4. Exercise overview, parent, subtest, comparison, alert, and point-link flows
   against live Treeherder.
5. Perform responsive light/dark visual review.
6. Complete an independent architecture/code review.
7. Push only after every deterministic gate passes; verify GitHub Pages.

## Deferred only when the upstream API cannot support it

No AWFY2 server will be introduced solely for a feature. Anything requiring
credentials, cross-origin mutation, or durable user state remains a link into
Treeherder/Perfherder until a static-safe upstream API exists.
