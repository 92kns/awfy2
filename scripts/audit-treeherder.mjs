import { appendFile } from 'node:fs/promises';
import { createServer } from 'vite';

const vite = await createServer({
  appType: 'custom',
  server: { middlewareMode: true },
});

try {
  const { GroupedDiagnostics } = await vite.ssrLoadModule(
    '/src/domain/diagnostics.ts',
  );
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

  function report(results) {
    const diagnostics = GroupedDiagnostics.fromResults(results);
    const actionable = [
      ...diagnostics.ambiguous,
      ...diagnostics.invalidResponse,
      ...diagnostics.network,
    ];
    const lines = [
      '# Treeherder configured-series audit',
      '',
      `Checked ${results.length} unique configured series; ${results.filter((result) => result.status === 'success').length} resolved.`,
      `${diagnostics.unsupported.length} unsupported logical series are expected platform gaps and do not fail this audit.`,
    ];

    if (actionable.length === 0) {
      lines.push('', 'No actionable configured-series problems found.');
      return { actionable, text: lines.join('\n') };
    }

    lines.push('', '## Actionable configured-series problems', '');
    for (const diagnostic of actionable) {
      lines.push(
        `- **${diagnostic.kind}** — ${diagnostic.series.label} (${diagnostic.series.suite}) on ${diagnostic.aliases.map((alias) => alias.platform).join(', ')}: ${diagnostic.message}`,
      );
    }
    return { actionable, text: lines.join('\n') };
  }

  try {
    const { actionable, text } = report(await audit());
    console.log(text);

    if (process.env.GITHUB_STEP_SUMMARY) {
      await appendFile(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
    }

    if (actionable.length > 0) process.exitCode = 1;
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
