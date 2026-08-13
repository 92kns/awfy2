<script lang="ts">
  import {
    GroupedDiagnostics,
    type DiagnosticKind,
  } from '../domain/diagnostics';
  import type { SeriesQueryFailure } from '../domain/types';

  let {
    errors,
    warnings = [],
  }: { errors: SeriesQueryFailure[]; warnings?: string[] } = $props();
  let diagnostics = $derived(GroupedDiagnostics.fromResults(errors));

  function statusLabel(kind: DiagnosticKind): string {
    return kind === 'unsupported'
      ? 'unresolved configuration'
      : kind === 'invalid-response'
        ? 'invalid response'
        : kind === 'network'
          ? 'network error'
          : 'ambiguous signature';
  }
</script>

{#if warnings.length > 0}
  <!-- Degraded enrichment, not a failure: the graphs below are still valid. -->
  <section
    class="diagnostics warnings"
    aria-label="Data warnings"
    role="status"
  >
    <ul>
      {#each warnings as warning}
        <li>{warning}</li>
      {/each}
    </ul>
  </section>
{/if}

{#if diagnostics.all.length > 0}
  <section class="diagnostics" aria-label="Diagnostics">
    <details>
      <!-- A single heading keeps the document outline h1 → h2 → h3. -->
      <summary>
        <h2>
          {diagnostics.all.length} configured comparison{diagnostics.all
            .length === 1
            ? ''
            : 's'} need attention
          <span class="summary-hint">View grouped details</span>
        </h2>
      </summary>
      <div class="groups">
        {#each diagnostics.all as diagnostic}
          <section class="group">
            <h3>{statusLabel(diagnostic.kind)}</h3>
            <p>{diagnostic.message}</p>
            <strong>{diagnostic.series.label}</strong>
            <small>
              {diagnostic.aliases
                .map((alias) => `${alias.platform} / ${alias.suite}`)
                .join(', ')}
            </small>
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

  .warnings {
    border-color: color-mix(in srgb, #e5a45e 45%, var(--border));
  }

  .warnings ul {
    display: grid;
    gap: 0.3rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  summary {
    cursor: pointer;
    font-weight: 650;
  }

  summary h2 {
    display: inline;
    font-size: inherit;
    font-weight: inherit;
    margin: 0;
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

  .group > strong {
    color: var(--text);
    display: block;
    margin-top: 0.4rem;
  }

  small {
    display: block;
  }
</style>
