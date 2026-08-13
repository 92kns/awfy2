<script lang="ts">
  import type { SeriesQueryFailure } from '../domain/types';

  let { errors }: { errors: SeriesQueryFailure[] } = $props();

  let grouped = $derived.by(() => {
    const groups = new Map<string, SeriesQueryFailure[]>();
    for (const error of errors) {
      const key = `${error.status} — ${error.message}`;
      groups.set(key, [...(groups.get(key) ?? []), error]);
    }
    return [...groups.entries()].sort(
      (left, right) => right[1].length - left[1].length,
    );
  });

  function statusLabel(status: SeriesQueryFailure['status']): string {
    return status === 'not-found'
      ? 'not found'
      : status === 'invalid-response'
        ? 'invalid response'
        : status === 'network-error'
          ? 'network error'
          : 'ambiguous';
  }
</script>

{#if errors.length > 0}
  <section class="diagnostics" aria-label="Diagnostics">
    <details>
      <summary>
        {errors.length} comparison{errors.length === 1 ? '' : 's'} unavailable
        <span class="summary-hint">View grouped details</span>
      </summary>
      <div class="groups">
        {#each grouped as [key, entries]}
          <section class="group">
            <h3>{entries.length} × {statusLabel(entries[0]!.status)}</h3>
            <p>{key.slice(key.indexOf('—') + 1).trim()}</p>
            <ul>
              {#each entries as error}
                <li>
                  <strong>{error.series.label}</strong>
                  <small>{error.series.platform} / {error.series.suite}</small>
                </li>
              {/each}
            </ul>
          </section>
        {/each}
      </div>
    </details>
  </section>
{/if}

<style>
  .diagnostics {
    background: color-mix(in srgb, var(--panel) 92%, transparent);
    border: 1px solid var(--border);
    border-radius: 0.65rem;
    color: var(--muted);
    font-size: 0.8rem;
    margin-bottom: 1rem;
    padding: 0.65rem 0.8rem;
  }

  summary {
    cursor: pointer;
    font-weight: 650;
  }

  .summary-hint {
    font-size: 0.73rem;
    font-weight: 450;
    margin-left: 0.4rem;
  }

  .groups {
    display: grid;
    gap: 0.75rem;
    margin-top: 0.75rem;
  }

  .group {
    border-top: 1px solid var(--border);
    padding-top: 0.55rem;
  }

  h3,
  p {
    margin: 0;
  }

  h3 {
    color: var(--text);
    font-size: 0.8rem;
  }

  p {
    margin-top: 0.2rem;
  }

  ul {
    list-style: none;
    margin: 0.4rem 0 0;
    padding: 0;
  }

  li + li {
    margin-top: 0.3rem;
  }

  small {
    display: block;
  }
</style>
