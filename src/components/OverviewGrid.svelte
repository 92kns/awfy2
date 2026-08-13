<script lang="ts">
  import type { BenchmarkLoadResult } from '../domain/types';
  import { groupOverviewResults, overviewMovers } from '../domain/overview';
  import OverviewCard from './OverviewCard.svelte';

  let {
    categoryLabel,
    results,
    onselect,
    days,
  }: {
    categoryLabel: string;
    days: number;
    results: BenchmarkLoadResult[];
    onselect: (benchmarkId: string) => void;
  } = $props();
  let groups = $derived(groupOverviewResults(results, categoryLabel));
  let movers = $derived(overviewMovers(results, days));
</script>

<section class="overview" aria-label="Benchmark overview">
  <div class="overview-heading">
    <div>
      <p class="eyebrow">Performance domain</p>
      <h2>{categoryLabel}</h2>
    </div>
    <span class="count"
      >{results.length} benchmark{results.length === 1 ? '' : 's'}</span
    >
  </div>

  {#if movers.improvements.length > 0 || movers.regressions.length > 0}
    <section class="movers" aria-label="Largest recent changes">
      {#if movers.improvements.length > 0}
        <div class="mover-group">
          <h3>Largest improvements</h3>
          {#each movers.improvements as mover}
            <button type="button" onclick={() => onselect(mover.benchmarkId)}>
              <span>{mover.benchmarkLabel} · {mover.seriesLabel}</span>
              <strong class="improved">
                {mover.percentage > 0 ? '+' : ''}{mover.percentage.toFixed(2)}%
              </strong>
            </button>
          {/each}
        </div>
      {/if}
      {#if movers.regressions.length > 0}
        <div class="mover-group">
          <h3>Largest regressions</h3>
          {#each movers.regressions as mover}
            <button type="button" onclick={() => onselect(mover.benchmarkId)}>
              <span>{mover.benchmarkLabel} · {mover.seriesLabel}</span>
              <strong class="regressed">
                {mover.percentage > 0 ? '+' : ''}{mover.percentage.toFixed(2)}%
              </strong>
            </button>
          {/each}
        </div>
      {/if}
    </section>
  {/if}

  {#each groups as group}
    <section class="domain-group" aria-labelledby={`domain-${group.domain}`}>
      <div class="domain-heading">
        <h3 id={`domain-${group.domain}`}>{group.domain}</h3>
        <span>{group.results.length}</span>
      </div>
      <div class="overview-grid">
        {#each group.results as result (result.benchmarkId)}
          <OverviewCard
            {days}
            {result}
            onclick={() => onselect(result.benchmarkId)}
          />
        {/each}
      </div>
    </section>
  {/each}
</section>

<style>
  .overview {
    margin-top: 0.5rem;
  }

  .overview-heading {
    align-items: end;
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .eyebrow {
    color: var(--muted);
    font-size: 0.68rem;
    font-weight: 750;
    letter-spacing: 0.14em;
    margin: 0 0 0.15rem;
    text-transform: uppercase;
  }

  h2 {
    font-size: 1.2rem;
    margin: 0;
  }

  .count {
    color: var(--muted);
    font-size: 0.8rem;
  }

  .overview-grid {
    display: grid;
    gap: 0.75rem;
    grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  }

  .domain-group + .domain-group {
    margin-top: 1.25rem;
  }

  .domain-heading {
    align-items: center;
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.55rem;
  }

  .domain-heading h3 {
    font-size: 0.95rem;
    margin: 0;
  }

  .domain-heading span {
    color: var(--muted);
    font-size: 0.75rem;
  }

  .movers {
    display: grid;
    gap: 0.75rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin-bottom: 1.25rem;
  }

  .mover-group {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    padding: 0.75rem;
  }

  .mover-group h3 {
    font-size: 0.82rem;
    margin: 0 0 0.45rem;
  }

  .mover-group button {
    align-items: center;
    background: transparent;
    border: 0;
    color: var(--text);
    cursor: pointer;
    display: flex;
    font: inherit;
    font-size: 0.76rem;
    gap: 0.5rem;
    justify-content: space-between;
    padding: 0.25rem 0;
    text-align: start;
    width: 100%;
  }

  .mover-group strong.improved {
    color: #2f9e64;
  }

  .mover-group strong.regressed {
    color: #e25570;
  }

  @media (max-width: 700px) {
    .movers {
      grid-template-columns: 1fr;
    }
  }
</style>
