<script lang="ts">
  import { onMount } from 'svelte';
  import {
    DAY_MS,
    seriesMetrics,
    type SeriesMetrics,
  } from '../domain/chart-metrics';
  import type {
    ChartMode,
    ChartValueMode,
    GraphViewModel,
  } from '../domain/types';
  import Chart from './Chart.svelte';
  import { effectiveBaseline, pointTreeherderUrl } from './chart-options';

  let {
    graph,
    visibleSeries,
    days = 30,
    chartMode = 'scatter',
    valueMode = 'absolute',
    baseline = null,
  }: {
    baseline?: string | null;
    chartMode?: ChartMode;
    days?: number;
    graph: GraphViewModel;
    valueMode?: ChartValueMode;
    visibleSeries: string[] | null;
  } = $props();
  let chartHost = $state<HTMLDivElement>();
  let showChart = $state(false);

  const numberFormat = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  });
  const dateFormat = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  let seriesWithMetrics = $derived(
    graph.series.map((series) => ({
      metrics: seriesMetrics(series, {
        days,
        lowerIsBetter: graph.lowerIsBetter,
      }),
      series,
    })),
  );

  /**
   * The metrics strip is always absolute, while relative mode plots percent
   * against a baseline series, and the strip's own percentage is a change over
   * time. Two unlike percentages next to a percent axis have to be named, or an
   * absolute measurement reads as a relative one.
   */
  let comparisonWindow = $derived(days <= 30 ? 7 : 30);
  let metricsCaption = $derived(
    valueMode === 'relative'
      ? `Absolute ${graph.yLabel.toLocaleLowerCase()}; the chart above shows % vs ${
          effectiveBaseline(graph.series, baseline) ?? 'the baseline series'
        }. Percentages here are the change over the last ${comparisonWindow} days.`
      : `Change over the last ${comparisonWindow} days.`,
  );

  const MAX_KEYBOARD_LINKS = 6;

  /**
   * Chart points are only reachable with a pointer, so the same alerts and
   * pushes are also published as ordinary links.
   */
  let alertLinks = $derived(
    graph.series
      .flatMap((series) =>
        (series.alerts ?? []).map((alert) => ({
          alert,
          seriesLabel: series.label,
        })),
      )
      .filter((entry) => entry.alert.url)
      .sort(
        (left, right) =>
          (right.alert.timestamp ?? 0) - (left.alert.timestamp ?? 0),
      )
      .slice(0, MAX_KEYBOARD_LINKS),
  );

  let pushLinks = $derived(
    graph.series.flatMap((series) => {
      const points = [...series.data]
        .sort((left, right) => right.x - left.x)
        .slice(0, MAX_KEYBOARD_LINKS);
      return points.flatMap((point) => {
        const url = pointTreeherderUrl(point, graph.project);
        if (!url) return [];
        return [
          {
            label: `${series.label} · ${numberFormat.format(point.y)} · ${
              point.revision
                ? point.revision.slice(0, 12)
                : dateFormat.format(new Date(point.x))
            }`,
            url,
          },
        ];
      });
    }),
  );

  function ageLabel(timestamp: number | undefined): string {
    if (timestamp == null) return 'No timestamp';
    const age = Math.max(0, Date.now() - timestamp);
    if (age < 2 * 60 * 60 * 1000) return 'Updated recently';
    if (age < DAY_MS)
      return `Updated ${Math.floor(age / (60 * 60 * 1000))}h ago`;
    return `Updated ${Math.floor(age / DAY_MS)}d ago`;
  }

  function deltaLabel(metrics: SeriesMetrics): string | undefined {
    if (!metrics.delta) return undefined;
    const { percentage, value } = metrics.delta;
    const sign = value > 0 ? '+' : '';
    const percent =
      percentage == null
        ? ''
        : ` (${percentage > 0 ? '+' : ''}${numberFormat.format(percentage)}%)`;
    return `${sign}${numberFormat.format(value)}${percent}`;
  }

  function deltaDirection(metrics: SeriesMetrics): string {
    switch (metrics.delta?.direction) {
      case 'improved':
        return 'Improved';
      case 'regressed':
        return 'Regressed';
      case 'unchanged':
        return 'No change';
      default:
        return 'Change';
    }
  }

  function latestLink(
    metrics: SeriesMetrics,
  ): { label: string; url: string } | undefined {
    if (metrics.latestLink) return metrics.latestLink;
    if (!metrics.latest) return undefined;
    const url = pointTreeherderUrl(metrics.latest, graph.project);
    if (!url) return undefined;
    if (metrics.latest.revision) {
      return { label: `Revision ${metrics.latest.revision.slice(0, 12)}`, url };
    }
    if (metrics.latest.jobId != null) {
      return { label: `Job ${metrics.latest.jobId}`, url };
    }
    return { label: 'Latest push', url };
  }

  onMount(() => {
    if (!chartHost) return;
    if (!('IntersectionObserver' in window)) {
      showChart = true;
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          showChart = true;
          observer.disconnect();
        }
      },
      { rootMargin: '700px 0px' },
    );
    observer.observe(chartHost);
    return () => observer.disconnect();
  });
</script>

<article class="graph-card">
  <header>
    <div>
      <h2>{graph.title}</h2>
      {#if graph.subtitle}<p>{graph.subtitle}</p>{/if}
    </div>
    <div class="links">
      {#if graph.docUrl}
        <a href={graph.docUrl} target="_blank" rel="noreferrer">Docs</a>
      {/if}
      <a href={graph.perfherderUrl} target="_blank" rel="noreferrer">
        Open in Perfherder
      </a>
    </div>
  </header>

  <div class="graph-meta">
    <span
      class:unknown-direction={graph.lowerIsBetter == null}
      class="direction-badge"
    >
      {graph.lowerIsBetter === true
        ? 'Lower is better'
        : graph.lowerIsBetter === false
          ? 'Higher is better'
          : 'Direction unknown'}
    </span>
  </div>

  <ul class="legend" aria-label="Chart series">
    {#each graph.series as series}
      <li class:hidden={visibleSeries && !visibleSeries.includes(series.label)}>
        <i style={`--series-color: ${series.color}`}></i>{series.label}
      </li>
    {/each}
  </ul>

  {#if (graph.sources?.length ?? 0) > 1}
    <p class="provenance">
      Merged machine platforms: {graph.sources?.join(', ')}
    </p>
  {/if}

  <ul class="series-metrics" aria-label="Latest series metrics">
    {#each seriesWithMetrics as { series, metrics }}
      {@const link = latestLink(metrics)}
      {@const delta = deltaLabel(metrics)}
      <li class:hidden={visibleSeries && !visibleSeries.includes(series.label)}>
        <strong>{series.label}</strong>
        {#if metrics.latestValue != null}
          <span title={`Latest absolute value (${graph.yLabel})`}
            >{numberFormat.format(metrics.latestValue)}</span
          >
        {/if}
        <span title="Point count">{metrics.pointCount} pts</span>
        {#if metrics.lastTimestamp != null}
          <time
            class={`freshness ${metrics.freshness}`}
            datetime={new Date(metrics.lastTimestamp).toISOString()}
            title={dateFormat.format(new Date(metrics.lastTimestamp))}
            >{ageLabel(metrics.lastTimestamp)}</time
          >
        {/if}
        {#if delta}
          <span class={`delta ${metrics.delta?.direction ?? 'unknown'}`}>
            {deltaDirection(metrics)}
            {delta}
          </span>
        {/if}
        {#if link}
          <a href={link.url} target="_blank" rel="noreferrer">{link.label}</a>
        {/if}
      </li>
    {/each}
  </ul>
  <p class="metrics-caption">{metricsCaption}</p>

  {#if graph.series.some((series) => series.data.length > 0)}
    <div bind:this={chartHost} class="lazy-chart">
      {#if showChart}
        <Chart
          {baseline}
          {chartMode}
          {days}
          {graph}
          {valueMode}
          {visibleSeries}
        />
      {/if}
    </div>
  {:else}
    <div class="empty-chart">No data points in this time range.</div>
  {/if}

  {#if alertLinks.length > 0 || pushLinks.length > 0}
    <details class="point-links">
      <summary>Alerts and recent pushes</summary>
      {#if alertLinks.length > 0}
        <ul aria-label={`Perfherder alerts for ${graph.title}`}>
          {#each alertLinks as { alert, seriesLabel }}
            <li>
              <span class={`marker ${alert.kind}`} aria-hidden="true"></span>
              <a href={alert.url} target="_blank" rel="noreferrer">
                {seriesLabel}: {alert.summary ??
                  (alert.kind === 'regression' ? 'Regression' : 'Alert')}
                {#if alert.timestamp != null}
                  · {dateFormat.format(new Date(alert.timestamp))}
                {/if}
              </a>
            </li>
          {/each}
        </ul>
      {/if}
      {#if pushLinks.length > 0}
        <ul aria-label={`Recent pushes for ${graph.title}`}>
          {#each pushLinks as link}
            <li>
              <a href={link.url} target="_blank" rel="noreferrer"
                >{link.label}</a
              >
            </li>
          {/each}
        </ul>
      {/if}
    </details>
  {/if}
</article>

<style>
  .graph-card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 0.85rem;
    box-shadow: var(--shadow);
    padding: 1.1rem;
  }

  header {
    align-items: start;
    display: flex;
    gap: 1rem;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  h2 {
    font-size: 1.1rem;
    margin: 0;
  }

  p {
    color: var(--muted);
    margin: 0.25rem 0 0;
  }

  .links {
    display: flex;
    flex-wrap: wrap;
    font-size: 0.8rem;
    gap: 0.75rem;
    justify-content: end;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    font-size: 0.78rem;
    gap: 0.45rem 1rem;
    list-style: none;
    margin: 0 0 0.5rem;
    padding: 0;
  }

  .provenance {
    color: var(--muted);
    font-size: 0.72rem;
    margin: 0 0 0.5rem;
  }

  .point-links {
    font-size: 0.74rem;
    margin-top: 0.75rem;
  }

  .point-links summary {
    color: var(--muted);
    cursor: pointer;
    font-weight: 650;
  }

  .point-links ul {
    display: grid;
    gap: 0.2rem;
    list-style: none;
    margin: 0.5rem 0 0;
    padding: 0;
  }

  .point-links li {
    align-items: center;
    display: flex;
    gap: 0.35rem;
  }

  .point-links .marker {
    background: #f7b955;
    border-radius: 2px;
    display: inline-block;
    height: 0.5rem;
    width: 0.5rem;
  }

  .point-links .marker.regression {
    background: #ef476f;
  }

  .graph-meta {
    margin-bottom: 0.55rem;
  }

  .direction-badge {
    background: color-mix(in srgb, var(--accent) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 55%, var(--border));
    border-radius: 999px;
    color: var(--text);
    display: inline-block;
    font-size: 0.7rem;
    font-weight: 650;
    padding: 0.16rem 0.45rem;
  }

  .direction-badge.unknown-direction {
    border-color: var(--border-strong);
    color: var(--muted);
  }

  .legend li {
    align-items: center;
    display: inline-flex;
    gap: 0.35rem;
  }

  .legend li.hidden {
    opacity: 0.38;
    text-decoration: line-through;
  }

  .legend i {
    background: var(--series-color);
    border-radius: 999px;
    display: inline-block;
    height: 0.55rem;
    width: 0.55rem;
  }

  .metrics-caption {
    color: var(--muted);
    font-size: 0.7rem;
    margin: 0 0 0.75rem;
  }

  .series-metrics {
    display: flex;
    flex-wrap: wrap;
    font-size: 0.72rem;
    gap: 0.4rem 0.8rem;
    list-style: none;
    margin: 0 0 0.35rem;
    padding: 0;
  }

  .series-metrics li {
    align-items: center;
    background: color-mix(in srgb, var(--control) 70%, transparent);
    border: 1px solid var(--border);
    border-radius: 0.45rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 0.45rem;
    padding: 0.3rem 0.45rem;
  }

  .series-metrics li.hidden {
    opacity: 0.48;
  }

  .freshness {
    color: var(--muted);
  }

  .freshness.stale {
    color: #e5a45e;
  }

  .freshness.fresh {
    color: #70c995;
  }

  .delta {
    font-weight: 650;
  }

  .delta.improved {
    color: #70c995;
  }

  .delta.regressed {
    color: #ef7890;
  }

  .empty-chart {
    align-items: center;
    color: var(--muted);
    display: flex;
    height: 12rem;
    justify-content: center;
  }

  .lazy-chart {
    min-height: clamp(18rem, 38vw, 30rem);
  }

  @media (max-width: 650px) {
    header {
      display: block;
    }

    .links {
      justify-content: start;
      margin-top: 0.65rem;
    }
  }
</style>
