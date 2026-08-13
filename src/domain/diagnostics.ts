import type { ResolvedSeries, SeriesQueryResult } from './types';

export type DiagnosticKind =
  'unsupported' | 'ambiguous' | 'invalid-response' | 'network';

export interface SeriesDiagnostic {
  aliases: ResolvedSeries[];
  kind: DiagnosticKind;
  message: string;
  series: ResolvedSeries;
}

type SeriesDiagnosticInput = Pick<SeriesQueryResult, 'series' | 'status'> & {
  message?: string | undefined;
};

function logicalSeriesId(series: ResolvedSeries): string {
  return JSON.stringify([
    series.application ?? '',
    [...(series.extraOptions ?? [])].sort(),
    series.frameworkId,
    series.label,
    series.option,
    series.project ?? '',
    series.suite,
    series.test ?? '',
  ]);
}

function diagnosticKind(
  status: SeriesQueryResult['status'],
): DiagnosticKind | null {
  switch (status) {
    case 'not-found':
      return 'unsupported';
    case 'ambiguous':
      return 'ambiguous';
    case 'invalid-response':
      return 'invalid-response';
    case 'network-error':
      return 'network';
    case 'success':
      return null;
  }
}

/**
 * Groups series failures for concise, platform-aware reporting.
 *
 * A view can include retired and replacement machine-platform aliases. A
 * successful alias suppresses failures for its logical series, and remaining
 * aliases are reported together without changing the input objects.
 */
export class GroupedDiagnostics {
  readonly ambiguous: readonly SeriesDiagnostic[];
  readonly invalidResponse: readonly SeriesDiagnostic[];
  readonly network: readonly SeriesDiagnostic[];
  readonly unsupported: readonly SeriesDiagnostic[];

  private constructor(groups: readonly SeriesDiagnostic[]) {
    this.unsupported = groups.filter((group) => group.kind === 'unsupported');
    this.ambiguous = groups.filter((group) => group.kind === 'ambiguous');
    this.invalidResponse = groups.filter(
      (group) => group.kind === 'invalid-response',
    );
    this.network = groups.filter((group) => group.kind === 'network');
  }

  static fromResults(
    results: readonly SeriesDiagnosticInput[],
  ): GroupedDiagnostics {
    const successfulSeries = new Set(
      results
        .filter((result) => result.status === 'success')
        .map((result) => logicalSeriesId(result.series)),
    );
    const grouped = new Map<string, SeriesDiagnostic>();

    for (const result of results) {
      const kind = diagnosticKind(result.status);
      const seriesId = logicalSeriesId(result.series);
      if (!kind || successfulSeries.has(seriesId)) continue;

      const key = `${kind}:${seriesId}`;
      const existing = grouped.get(key);
      if (existing) {
        if (
          !existing.aliases.some(
            (alias) => alias.platform === result.series.platform,
          )
        ) {
          existing.aliases.push(result.series);
        }
        continue;
      }

      grouped.set(key, {
        aliases: [result.series],
        kind,
        message: result.message ?? defaultMessage(kind),
        series: result.series,
      });
    }

    return new GroupedDiagnostics([...grouped.values()]);
  }

  get all(): readonly SeriesDiagnostic[] {
    return [
      ...this.unsupported,
      ...this.ambiguous,
      ...this.invalidResponse,
      ...this.network,
    ];
  }
}

function defaultMessage(kind: DiagnosticKind): string {
  switch (kind) {
    case 'unsupported':
      return 'No Treeherder signature matches this configured series.';
    case 'ambiguous':
      return 'More than one Treeherder signature matches this configured series.';
    case 'invalid-response':
      return 'Treeherder returned an unexpected response.';
    case 'network':
      return 'Treeherder could not be reached.';
  }
}
