<script lang="ts">
  import type { AppSelection } from '../app/url-state';
  import { buildBenchmarkQueries } from '../domain/presets';
  import type { DashboardPreset } from '../domain/types';

  let {
    availableSeries,
    onchange,
    preset,
    selection,
  }: {
    availableSeries: string[];
    onchange: (selection: AppSelection) => void;
    preset: DashboardPreset;
    selection: AppSelection;
  } = $props();

  let view = $derived(preset.config.views[selection.platform]!);
  let category = $derived(view.categories[selection.category]!);
  let isBenchmark = $derived(selection.benchmark !== 'overview');
  let applicableBenchmarks = $derived(
    category.suites.filter(
      (benchmarkId) =>
        buildBenchmarkQueries(
          preset.benchmarks,
          view,
          benchmarkId,
          selection.category,
          { project: selection.project },
        ).length > 0,
    ),
  );

  function resetForContext(next: Partial<AppSelection>): AppSelection {
    return {
      ...selection,
      ...next,
      benchmark: next.benchmark ?? 'overview',
      detail: 'summary',
      baseline: null,
      subtestSearch: '',
      visibleSeries: null,
    };
  }

  function choosePlatform(platform: string) {
    const nextView = preset.config.views[platform]!;
    const categoryId = nextView.categories[selection.category]
      ? selection.category
      : Object.keys(nextView.categories)[0]!;
    onchange(resetForContext({ platform, category: categoryId }));
  }

  function chooseCategory(categoryId: string) {
    onchange(resetForContext({ category: categoryId }));
  }

  function chooseBenchmark(benchmark: string) {
    onchange(resetForContext({ benchmark }));
  }

  function toggleSeries(label: string) {
    const visible = selection.visibleSeries ?? availableSeries;
    const next = visible.includes(label)
      ? visible.filter((item) => item !== label)
      : [...visible, label];
    onchange({
      ...selection,
      visibleSeries:
        next.length === availableSeries.length ? null : next.sort(),
    });
  }

  function setDetail(detail: AppSelection['detail']) {
    onchange({
      ...selection,
      detail,
      subtestSearch: detail === 'subtests' ? selection.subtestSearch : '',
    });
  }
</script>

<section class="controls" aria-label="Dashboard controls">
  <div class="primary-row">
    <label>
      <span>Platform</span>
      <select
        value={selection.platform}
        onchange={(event) => choosePlatform(event.currentTarget.value)}
      >
        {#each Object.entries(preset.config.views) as [id, option]}
          <option value={id}>{option.label}</option>
        {/each}
      </select>
    </label>

    <label>
      <span>Category</span>
      <select
        value={selection.category}
        onchange={(event) => chooseCategory(event.currentTarget.value)}
      >
        {#each Object.entries(view.categories) as [id, option]}
          <option value={id}>{option.label}</option>
        {/each}
      </select>
    </label>

    <label class="benchmark-control">
      <span>Benchmark</span>
      <select
        value={selection.benchmark}
        onchange={(event) => chooseBenchmark(event.currentTarget.value)}
      >
        <option value="overview">Overview</option>
        {#each [...applicableBenchmarks].sort( (left, right) => preset.benchmarks[left]!.label.localeCompare(preset.benchmarks[right]!.label) ) as id}
          <option value={id}>{preset.benchmarks[id]!.label}</option>
        {/each}
      </select>
    </label>

    <label>
      <span>Time range</span>
      <select
        value={selection.days}
        onchange={(event) =>
          onchange({ ...selection, days: Number(event.currentTarget.value) })}
      >
        {#each preset.config.dayRange as days}
          <option value={days}
            >{days === 365
              ? 'Last year'
              : `Last ${days} day${days === 1 ? '' : 's'}`}</option
          >
        {/each}
      </select>
    </label>

    {#if isBenchmark}
      <button
        class="detail-action"
        type="button"
        aria-pressed={selection.detail === 'subtests'}
        onclick={() =>
          setDetail(selection.detail === 'subtests' ? 'summary' : 'subtests')}
      >
        {selection.detail === 'subtests'
          ? 'Load parent score'
          : 'Load subtests'}
      </button>
    {/if}
  </div>

  <details class="advanced">
    <summary>Advanced comparison controls</summary>
    <div class="advanced-grid">
      <label>
        <span>Project</span>
        <select
          value={selection.project}
          onchange={(event) =>
            onchange({
              ...selection,
              project: event.currentTarget.value as AppSelection['project'],
              baseline: null,
              visibleSeries: null,
            })}
        >
          <option value="configured">Configured projects</option>
          <option value="autoland">Autoland</option>
          <option value="mozilla-central">Mozilla Central</option>
        </select>
      </label>

      <label>
        <span>Chart</span>
        <select
          value={selection.chart}
          onchange={(event) =>
            onchange({
              ...selection,
              chart: event.currentTarget.value as AppSelection['chart'],
            })}
        >
          <option value="scatter">Scatter</option>
          <option value="trend">Trend</option>
          <option value="median">Median</option>
        </select>
      </label>

      <fieldset>
        <legend>Values</legend>
        <div class="radio-row">
          <label class="choice">
            <input
              type="radio"
              name="values"
              value="absolute"
              checked={selection.values === 'absolute'}
              onchange={() =>
                onchange({ ...selection, values: 'absolute', baseline: null })}
            />
            Absolute
          </label>
          <label class="choice">
            <input
              type="radio"
              name="values"
              value="relative"
              checked={selection.values === 'relative'}
              onchange={() => onchange({ ...selection, values: 'relative' })}
            />
            Relative
          </label>
        </div>
      </fieldset>

      {#if selection.values === 'relative'}
        <label>
          <span>Baseline series</span>
          <select
            value={selection.baseline ?? ''}
            onchange={(event) =>
              onchange({
                ...selection,
                baseline: event.currentTarget.value || null,
              })}
          >
            <option value="">Choose a baseline</option>
            {#each availableSeries as label}
              <option value={label}>{label}</option>
            {/each}
          </select>
        </label>
      {/if}
    </div>

    {#if availableSeries.length > 1}
      <fieldset class="series-fieldset">
        <legend>Visible browser / series</legend>
        <div class="series-list">
          {#each availableSeries as label}
            <label class="series-toggle">
              <input
                type="checkbox"
                checked={selection.visibleSeries
                  ? selection.visibleSeries.includes(label)
                  : true}
                onchange={() => toggleSeries(label)}
              />
              <span>{label}</span>
            </label>
          {/each}
        </div>
      </fieldset>
    {/if}
  </details>

  {#if selection.detail === 'subtests'}
    <label class="subtest-search">
      <span>Filter subtests</span>
      <input
        type="search"
        value={selection.subtestSearch}
        placeholder="Search subtest names"
        oninput={(event) =>
          onchange({ ...selection, subtestSearch: event.currentTarget.value })}
      />
    </label>
  {/if}
</section>

<style>
  .controls {
    align-items: stretch;
    background: color-mix(in srgb, var(--panel) 92%, transparent);
    border: 1px solid var(--border);
    border-radius: 0.85rem;
    display: grid;
    gap: 0.8rem;
    padding: 0.9rem;
    position: sticky;
    top: 0.6rem;
    z-index: 5;
  }

  .primary-row,
  .advanced-grid {
    align-items: end;
    display: grid;
    gap: 0.8rem;
    grid-template-columns: repeat(4, minmax(9rem, 1fr));
  }

  .detail-action {
    align-self: end;
    background: var(--accent);
    border: 1px solid var(--accent);
    border-radius: 0.5rem;
    color: #1a0c06;
    cursor: pointer;
    font: inherit;
    font-weight: 700;
    min-height: 2.55rem;
    padding: 0.45rem 0.75rem;
  }

  label > span,
  legend {
    color: var(--muted);
    display: block;
    font-size: 0.72rem;
    font-weight: 650;
    letter-spacing: 0.05em;
    margin-bottom: 0.35rem;
    text-transform: uppercase;
  }

  select,
  input[type='search'] {
    background: var(--control);
    border: 1px solid var(--border-strong);
    border-radius: 0.5rem;
    color: var(--text);
    font: inherit;
    min-height: 2.55rem;
    padding: 0.45rem 0.65rem;
    width: 100%;
  }

  fieldset {
    border: 0;
    margin: 0;
    padding: 0;
  }

  .advanced {
    border-top: 1px solid var(--border);
    padding-top: 0.7rem;
  }

  .advanced summary {
    color: var(--muted);
    cursor: pointer;
    font-size: 0.82rem;
    font-weight: 650;
    margin-bottom: 0.75rem;
  }

  .radio-row,
  .series-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem 1rem;
  }

  .choice,
  .series-toggle {
    align-items: center;
    display: flex;
    font-size: 0.82rem;
    gap: 0.35rem;
  }

  .choice input,
  .series-toggle input {
    margin: 0;
  }

  .series-fieldset {
    grid-column: 1 / -1;
    margin-top: 0.2rem;
  }

  .series-toggle span {
    color: var(--text);
    font-size: inherit;
    font-weight: 500;
    letter-spacing: 0;
    margin: 0;
    text-transform: none;
  }

  .subtest-search {
    max-width: 32rem;
  }

  @media (max-width: 850px) {
    .controls {
      position: static;
    }

    .primary-row,
    .advanced-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 520px) {
    .primary-row,
    .advanced-grid {
      display: block;
    }

    .primary-row > label,
    .primary-row > button,
    .advanced-grid > label,
    .advanced-grid > fieldset {
      margin-top: 0.75rem;
    }

    .primary-row > :first-child,
    .advanced-grid > :first-child {
      margin-top: 0;
    }
  }
</style>
