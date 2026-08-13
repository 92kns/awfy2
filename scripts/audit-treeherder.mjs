import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

const BASELINE_URL = new URL('./audit-baseline.txt', import.meta.url);
const UPDATE_BASELINE = process.argv.includes('--update-baseline');

const vite = await createServer({
  appType: 'custom',
  server: { middlewareMode: true },
});

try {
  const {
    compareToBaseline,
    EMPTY_AUDIT_BASELINE,
    formatAuditBaseline,
    parseAuditBaseline,
  } = await vite.ssrLoadModule('/src/domain/audit.ts');
  const { GroupedDiagnostics } = await vite.ssrLoadModule(
    '/src/domain/diagnostics.ts',
  );

  async function readBaseline() {
    try {
      return parseAuditBaseline(await readFile(BASELINE_URL, 'utf8'));
    } catch (error) {
      if (error?.code === 'ENOENT') return EMPTY_AUDIT_BASELINE;
      throw error;
    }
  }
  const { buildBenchmarkQueries } = await vite.ssrLoadModule(
    '/src/domain/presets.ts',
  );
  const { default: preset } = await vite.ssrLoadModule('/src/presets/awfy.ts');
  const {
    normalizeSignature,
    optionCollectionsSchema,
    signaturesResponseSchema,
  } = await vite.ssrLoadModule('/src/treeherder/schemas.ts');
  const { indexOptionCollections, resolveSignature } = await vite.ssrLoadModule(
    '/src/treeherder/signatures.ts',
  );
  const { optionCollectionsUrl, platformSignaturesUrl } =
    await vite.ssrLoadModule('/src/treeherder/urls.ts');

  class AuditInvalidResponseError extends Error {
    constructor(url) {
      super(`Treeherder returned an unexpected response for ${url}`);
      this.name = 'AuditInvalidResponseError';
    }
  }

  async function fetchJson(url, schema) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Treeherder request failed: ${response.status}`);
    }
    const parsed = schema.safeParse(await response.json());
    if (!parsed.success) throw new AuditInvalidResponseError(url.toString());
    return parsed.data;
  }

  function configuredSeries() {
    const series = new Map();

    for (const view of Object.values(preset.config.views)) {
      for (const [categoryId, category] of Object.entries(view.categories)) {
        for (const benchmarkId of category.suites) {
          for (const query of buildBenchmarkQueries(
            preset.benchmarks,
            view,
            benchmarkId,
            categoryId,
          )) {
            for (const configured of query.series) {
              const key = JSON.stringify([
                configured.application ?? '',
                [...(configured.extraOptions ?? [])].sort(),
                configured.frameworkId,
                configured.option,
                configured.platform,
                configured.project ?? '',
                configured.suite,
                configured.test ?? '',
              ]);
              series.set(key, configured);
            }
          }
        }
      }
    }

    return [...series.values()];
  }

  function resultMessage(status, candidateCount) {
    switch (status) {
      case 'not-found':
        return 'No Treeherder signature matches this configured series.';
      case 'ambiguous':
        return `Expected one signature but found ${candidateCount ?? 0}.`;
      default:
        return '';
    }
  }

  async function audit() {
    const series = configuredSeries();
    const optionCollections = await fetchJson(
      optionCollectionsUrl(),
      optionCollectionsSchema,
    );
    const optionsByHash = indexOptionCollections(optionCollections);
    const signaturesByUrl = new Map();

    function signaturesFor(configured) {
      const url = platformSignaturesUrl(configured);
      const key = url.toString();
      let request = signaturesByUrl.get(key);
      if (!request) {
        request = fetchJson(url, signaturesResponseSchema).then((raw) =>
          Object.values(raw).map(normalizeSignature),
        );
        signaturesByUrl.set(key, request);
      }
      return request;
    }

    return Promise.all(
      series.map(async (configured) => {
        try {
          const resolution = resolveSignature(
            await signaturesFor(configured),
            configured,
            optionsByHash,
          );
          if (resolution.status === 'resolved') {
            return { series: configured, status: 'success' };
          }
          return {
            message: resultMessage(
              resolution.status,
              resolution.candidates.length,
            ),
            series: configured,
            status: resolution.status,
          };
        } catch (error) {
          return {
            message: error instanceof Error ? error.message : 'Unknown error',
            series: configured,
            status:
              error instanceof AuditInvalidResponseError
                ? 'invalid-response'
                : 'network-error',
          };
        }
      }),
    );
  }

  function report(results, baseline) {
    const diagnostics = GroupedDiagnostics.fromResults(results);
    const actionable = [
      ...diagnostics.ambiguous,
      ...diagnostics.invalidResponse,
      ...diagnostics.network,
    ];
    const {
      added,
      failing,
      grewBy,
      notFoundChanged,
      notFoundKeys,
      notFoundTotal,
      regressed,
      resolvedKeys,
    } = compareToBaseline(results, baseline, actionable.length > 0);

    const lines = [
      '# Treeherder configured-series audit',
      '',
      `Checked ${results.length} unique configured series; ${resolvedKeys.length} resolved.`,
      `${diagnostics.unsupported.length} unresolved logical configurations (${notFoundTotal} series) remain as legacy preset debt.`,
      baseline.resolved.size === 0
        ? 'No baseline is recorded yet, so only ambiguity, invalid responses, and network failures fail this run.'
        : `${regressed.length} previously resolving series no longer resolve; ${added.length} newly resolve.`,
      'Ambiguous matches, invalid API responses, network failures, series that stop resolving, and any change to the reviewed not-found set fail this audit.',
    ];

    if (regressed.length > 0) {
      lines.push(
        '',
        '## Configured series that stopped resolving',
        '',
        'These resolved when the baseline was recorded, so either Treeherder retired them or the preset drifted.',
        '',
      );
      for (const key of regressed.slice(0, 50)) lines.push(`- \`${key}\``);
      if (regressed.length > 50) {
        lines.push(`- …and ${regressed.length - 50} more.`);
      }
    }

    if (notFoundChanged) {
      lines.push(
        '',
        '## Not-found baseline changed',
        '',
        grewBy > 0
          ? `The not-found total rose by ${grewBy} to ${notFoundTotal}.`
          : `The exact not-found set changed while its total is ${notFoundTotal}.`,
        'Curate the affected applicability or refresh the baseline deliberately after reviewing the change.',
      );
    }

    if (added.length > 0) {
      lines.push(
        '',
        '## Newly resolving series',
        '',
        `${added.length} configured series resolve that did not before. Refresh the baseline with \`npm run audit:live -- --update-baseline\`.`,
      );
      for (const key of added.slice(0, 20)) lines.push(`- \`${key}\``);
    }

    if (actionable.length > 0) {
      lines.push('', '## Actionable configured-series problems', '');
      for (const diagnostic of actionable) {
        lines.push(
          `- **${diagnostic.kind}** — ${diagnostic.series.label} (${diagnostic.series.suite}) on ${diagnostic.aliases.map((alias) => alias.platform).join(', ')}: ${diagnostic.message}`,
        );
      }
    }

    if (!failing) {
      lines.push('', 'No actionable configured-series problems found.');
    }

    return {
      failing,
      notFoundKeys,
      notFoundTotal,
      resolvedKeys,
      text: lines.join('\n'),
    };
  }

  try {
    const results = await audit();
    const { failing, notFoundKeys, notFoundTotal, resolvedKeys, text } = report(
      results,
      await readBaseline(),
    );
    console.log(text);

    if (UPDATE_BASELINE) {
      await writeFile(
        BASELINE_URL,
        formatAuditBaseline(resolvedKeys, notFoundKeys),
      );
      console.log(
        `\nWrote ${resolvedKeys.length} resolving series and a not-found total of ${notFoundTotal} to scripts/audit-baseline.txt.`,
      );
    }

    if (process.env.GITHUB_STEP_SUMMARY) {
      await appendFile(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
    }

    if (failing && !UPDATE_BASELINE) process.exitCode = 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const text = [
      '# Treeherder configured-series audit',
      '',
      '## Actionable configured-series problems',
      '',
      `- **network** — The audit could not load its shared Treeherder data: ${message}`,
    ].join('\n');
    console.log(text);
    if (process.env.GITHUB_STEP_SUMMARY) {
      await appendFile(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
    }
    process.exitCode = 1;
  }
} finally {
  await vite.close();
}
