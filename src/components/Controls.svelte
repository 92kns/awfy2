<script lang="ts">
  import type { AppSelection } from '../app/url-state';
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

  function choosePlatform(platform: string) {
    const nextView = preset.config.views[platform]!;
    const categoryId = nextView.categories[selection.category]
      ? selection.category
      : Object.keys(nextView.categories)[0]!;
    onchange({
      ...selection,
      benchmark: 'overview',
      category: categoryId,
      platform,
      visibleSeries: null,
    });
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
</script>

<section class="controls" aria-label="Dashboard controls">
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
      onchange={(event) =>
        onchange({
          ...selection,
          benchmark: 'overview',
          category: event.currentTarget.value,
          visibleSeries: null,
        })}
    >
      {#each Object.entries(view.categories) as [id, option]}
        <option value={id}>{option.label}</option>
      {/each}
    </select>
  </label>

  <label>
    <span>Results</span>
    <select
      value={selection.benchmark}
      onchange={(event) =>
        onchange({
          ...selection,
          benchmark: event.currentTarget.value,
          visibleSeries: null,
        })}
    >
      <option value="overview">Overview</option>
      {#each [...category.suites].sort( (left, right) => preset.benchmarks[left]!.label.localeCompare(preset.benchmarks[right]!.label) ) as id}
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

  {#if availableSeries.length > 1}
    <fieldset>
      <legend>Visible series</legend>
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
</section>

<style>
  .controls {
    align-items: end;
    background: color-mix(in srgb, var(--panel) 92%, transparent);
    border: 1px solid var(--border);
    border-radius: 0.85rem;
    display: grid;
    gap: 0.8rem;
    grid-template-columns: repeat(4, minmax(9rem, 1fr));
    padding: 0.9rem;
    position: sticky;
    top: 0.6rem;
    z-index: 5;
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

  select {
    background: var(--control);
    border: 1px solid var(--border-strong);
    border-radius: 0.5rem;
    color: var(--text);
    font: inherit;
    min-height: 2.55rem;
    padding: 0.45rem 2rem 0.45rem 0.65rem;
    width: 100%;
  }

  fieldset {
    border: 0;
    grid-column: 1 / -1;
    margin: 0;
    padding: 0.25rem 0 0;
  }

  .series-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 1rem;
  }

  .series-toggle {
    align-items: center;
    display: flex;
    font-size: 0.82rem;
    gap: 0.35rem;
  }

  .series-toggle span {
    color: var(--text);
    font-size: inherit;
    font-weight: 500;
    letter-spacing: 0;
    margin: 0;
    text-transform: none;
  }

  @media (max-width: 850px) {
    .controls {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      position: static;
    }
  }

  @media (max-width: 520px) {
    .controls {
      display: block;
    }

    .controls > label + label,
    fieldset {
      margin-top: 0.75rem;
    }
  }
</style>
