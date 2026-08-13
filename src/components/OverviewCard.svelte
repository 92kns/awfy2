<script lang="ts">
  import type { BenchmarkLoadResult, GraphViewModel } from '../domain/types';

  let {
    result,
    onclick,
  }: {
    result: BenchmarkLoadResult;
    onclick: () => void;
  } = $props();

  function latest(graph: GraphViewModel, label: string): number | null {
    const series = graph.series.find((item) => item.label === label);
    if (!series || series.data.length === 0) return null;
    return (
      [...series.data].sort((left, right) => right.x - left.x)[0]?.y ?? null
    );
  }

  let graph = $derived(result.graphs[0]);
  let seriesSummary = $derived(
    graph
      ? graph.series
          .map((series) => ({
            label: series.label,
            value: latest(graph!, series.label),
          }))
          .filter((item) => item.value !== null)
      : [],
  );
  const numberFormat = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  });
</script>

<button class="overview-card" type="button" {onclick}>
  <span class="card-heading">
    <strong>{result.label}</strong>
    <span aria-hidden="true">→</span>
  </span>
  {#if graph}
    <span class="metric-title">{graph.title}</span>
    {#if seriesSummary.length > 0}
      <span class="metrics" aria-label="Latest values">
        {#each seriesSummary.slice(0, 3) as item}
          <span class="metric">
            <span>{item.label}</span>
            <strong>{numberFormat.format(item.value!)}</strong>
          </span>
        {/each}
      </span>
    {:else}
      <span class="empty">No recent data</span>
    {/if}
  {:else}
    <span class="empty">No matching data</span>
  {/if}
</button>

<style>
  .overview-card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    box-shadow: var(--shadow);
    color: var(--text);
    cursor: pointer;
    display: block;
    font: inherit;
    padding: 0.85rem;
    text-align: start;
    transition:
      border-color 120ms ease,
      transform 120ms ease;
    width: 100%;
  }

  .overview-card:hover,
  .overview-card:focus-visible {
    border-color: var(--accent);
    transform: translateY(-1px);
  }

  .card-heading {
    display: flex;
    font-size: 0.95rem;
    gap: 0.5rem;
    justify-content: space-between;
  }

  .card-heading span {
    color: var(--accent);
  }

  .metric-title,
  .empty {
    color: var(--muted);
    display: block;
    font-size: 0.78rem;
    margin-top: 0.4rem;
  }

  .metrics {
    display: flex;
    flex-wrap: wrap;
    gap: 0.7rem;
    margin-top: 0.7rem;
  }

  .metric {
    display: grid;
    gap: 0.1rem;
  }

  .metric span {
    color: var(--muted);
    font-size: 0.7rem;
  }

  .metric strong {
    font-size: 0.9rem;
  }
</style>
