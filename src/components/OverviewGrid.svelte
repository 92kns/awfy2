<script lang="ts">
  import type { BenchmarkLoadResult } from '../domain/types';
  import OverviewCard from './OverviewCard.svelte';

  let {
    categoryLabel,
    results,
    onselect,
  }: {
    categoryLabel: string;
    results: BenchmarkLoadResult[];
    onselect: (benchmarkId: string) => void;
  } = $props();
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
  <div class="overview-grid">
    {#each results as result (result.benchmarkId)}
      <OverviewCard {result} onclick={() => onselect(result.benchmarkId)} />
    {/each}
  </div>
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
</style>
