<script lang="ts">
  import { onMount } from 'svelte';
  import {
    readSelection,
    selectionUrl,
    type AppSelection,
  } from './app/url-state';
  import Controls from './components/Controls.svelte';
  import Diagnostics from './components/Diagnostics.svelte';
  import GraphCard from './components/GraphCard.svelte';
  import OverviewGrid from './components/OverviewGrid.svelte';
  import { loadBenchmark } from './domain/graphs';
  import { buildBenchmarkQueries } from './domain/presets';
  import type { BenchmarkLoadResult } from './domain/types';
  import preset from './presets/awfy';

  interface LoadState {
    complete: boolean;
    results: BenchmarkLoadResult[];
    total: number;
  }

  let selection = $state<AppSelection>(
    readSelection(preset, new URL(window.location.href)),
  );
  let loadState = $state<LoadState>({ complete: false, results: [], total: 0 });

  let view = $derived(preset.config.views[selection.platform]!);
  let queries = $derived(
    buildBenchmarkQueries(
      preset.benchmarks,
      view,
      selection.benchmark,
      selection.category,
      { detail: selection.detail, project: selection.project },
    ),
  );
  let availableSeries = $derived([
    ...new Set(
      queries.flatMap((query) => query.series.map((series) => series.label)),
    ),
  ]);
  let loadedGraphs = $derived(
    loadState.results.flatMap((result) => result.graphs),
  );
  let filteredGraphs = $derived.by(() => {
    const search = selection.subtestSearch.trim().toLocaleLowerCase();
    if (!search || selection.detail !== 'subtests') return loadedGraphs;
    return loadedGraphs.filter((graph) =>
      graph.title.toLocaleLowerCase().includes(search),
    );
  });
  let errors = $derived(loadState.results.flatMap((result) => result.errors));
  let overviewResults = $derived(
    selection.benchmark === 'overview' ? loadState.results : [],
  );
  let resultCount = $derived(
    selection.detail === 'subtests' && selection.subtestSearch.trim()
      ? `${filteredGraphs.length} of ${loadedGraphs.length}`
      : String(filteredGraphs.length),
  );

  function changeSelection(next: AppSelection, replace = false) {
    selection = next;
    const url = selectionUrl(next, new URL(window.location.href));
    window.history[replace ? 'replaceState' : 'pushState']({}, '', url);
  }

  function chooseBenchmark(benchmark: string) {
    changeSelection({
      ...selection,
      benchmark,
      detail: 'summary',
      baseline: null,
      subtestSearch: '',
      visibleSeries: null,
    });
  }

  onMount(() => {
    const onPopState = () => {
      selection = readSelection(preset, new URL(window.location.href));
    };
    window.addEventListener('popstate', onPopState);
    changeSelection(selection, true);
    return () => window.removeEventListener('popstate', onPopState);
  });

  $effect(() => {
    const currentQueries = queries;
    const days = selection.days;
    const controller = new AbortController();
    loadState = { complete: false, results: [], total: currentQueries.length };

    const promises = currentQueries.map(async (query) => {
      const result = await loadBenchmark(query, days, controller.signal);
      if (!controller.signal.aborted) {
        loadState.results = [...loadState.results, result].sort((left, right) =>
          left.label.localeCompare(right.label),
        );
      }
    });

    void Promise.all(promises).then(() => {
      if (!controller.signal.aborted) loadState.complete = true;
    });

    return () => controller.abort();
  });
</script>

<svelte:head>
  <title>{preset.title}</title>
</svelte:head>

<header class="site-header">
  <div class="mark" aria-hidden="true">↗</div>
  <div>
    <p class="eyebrow">Firefox performance</p>
    <h1>{preset.title}</h1>
  </div>
  <a class="source-link" href="https://github.com/92kns/awfy2">Source</a>
</header>

<main>
  <Controls {availableSeries} onchange={changeSelection} {preset} {selection} />

  <section class="status" aria-live="polite">
    {#if !loadState.complete}
      <span class="spinner" aria-hidden="true"></span>
      Loaded {loadState.results.length} of {loadState.total} benchmark{loadState.total ===
      1
        ? ''
        : 's'}…
    {:else if selection.benchmark === 'overview'}
      Showing {overviewResults.length} benchmark summary card{overviewResults.length ===
      1
        ? ''
        : 's'}.
    {:else if filteredGraphs.length === 0}
      No matching performance data was found.
    {:else}
      Showing {resultCount} graph{filteredGraphs.length === 1 ? '' : 's'} from Treeherder.
    {/if}
  </section>

  <Diagnostics {errors} />

  {#if selection.benchmark === 'overview'}
    <OverviewGrid
      categoryLabel={view.categories[selection.category]?.label ??
        selection.category}
      results={overviewResults}
      onselect={chooseBenchmark}
    />
  {:else}
    <section class="graphs" aria-label="Performance graphs">
      {#each filteredGraphs as graph (graph.id)}
        <GraphCard {graph} visibleSeries={selection.visibleSeries} />
      {/each}
    </section>
  {/if}
</main>

<footer>
  Data comes from <a href="https://treeherder.mozilla.org/">Treeherder</a>.
  Every view is encoded in the URL so it can be shared.
</footer>
