<script lang="ts">
  import { onMount } from 'svelte';
  import type { GraphViewModel } from '../domain/types';
  import Chart from './Chart.svelte';

  let {
    graph,
    visibleSeries,
  }: { graph: GraphViewModel; visibleSeries: string[] | null } = $props();
  let chartHost = $state<HTMLDivElement>();
  let showChart = $state(false);

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

  <div class="legend" aria-label="Chart series">
    {#each graph.series as series}
      <span
        class:hidden={visibleSeries && !visibleSeries.includes(series.label)}
      >
        <i style={`--series-color: ${series.color}`}></i>{series.label}
      </span>
    {/each}
  </div>

  {#if graph.series.some((series) => series.data.length > 0)}
    <div bind:this={chartHost} class="lazy-chart">
      {#if showChart}
        <Chart {graph} {visibleSeries} />
      {/if}
    </div>
  {:else}
    <div class="empty-chart">No data points in this time range.</div>
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
    margin-bottom: 0.5rem;
  }

  .legend span {
    align-items: center;
    display: inline-flex;
    gap: 0.35rem;
  }

  .legend span.hidden {
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
