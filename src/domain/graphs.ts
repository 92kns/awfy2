import type {
  BenchmarkLoadResult,
  BenchmarkQuery,
  ChartPoint,
  ChartSeries,
  GraphViewModel,
  PerformanceAlert,
  PerformanceAlertMarker,
  SeriesQueryFailure,
  SeriesQueryResult,
} from './types';
import { querySeries } from '../treeherder/client';
import { perfherderAlertUrl } from '../treeherder/urls';

function graphId(title: string, test: string): string {
  return `${title}::${test}`;
}

/** Treeherder's own unit beats guessing from the improvement direction. */
export function yAxisLabelForSignature(signature: {
  lowerIsBetter?: boolean | undefined;
  measurementUnit?: string | undefined;
}): string {
  switch (signature.measurementUnit) {
    case 'ms':
      return 'Execution time (ms)';
    case 'score':
      return 'Score';
    case 'bytes':
      return 'Bytes';
    case undefined:
    case '':
      return signature.lowerIsBetter === false ? 'Score' : 'Value';
    default:
      return signature.measurementUnit;
  }
}

function logicalSeriesId(series: BenchmarkQuery['series'][number]): string {
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

/**
 * Treeherder reports `amount_pct` as an unsigned magnitude, so the direction of
 * the change is taken from the values it moved between and never from the
 * percentage itself.
 */
function alertChangeText(marker: PerformanceAlertMarker): string {
  if (marker.amountPct == null) return '';
  const rose =
    marker.newValue != null && marker.prevValue != null
      ? marker.newValue > marker.prevValue
      : marker.isRegression;
  const magnitude = Math.abs(marker.amountPct).toFixed(2);
  return ` (${rose ? '+' : '−'}${magnitude}%)`;
}

function chartAlert(marker: PerformanceAlertMarker): PerformanceAlert {
  const bug = marker.bugNumber == null ? '' : ` · Bug ${marker.bugNumber}`;
  return {
    kind: marker.isRegression ? 'regression' : 'alert',
    revision: marker.revision,
    summary: `${marker.isRegression ? 'Regression' : 'Improvement'}${alertChangeText(marker)}${bug}`,
    timestamp: marker.timestamp,
    // A reassigned or downstream alert is discussed in another summary.
    url: perfherderAlertUrl(marker.relatedSummaryId ?? marker.summaryId),
  };
}

function alertKey(alert: PerformanceAlert): string {
  return `${alert.url ?? ''}|${alert.revision ?? ''}|${alert.timestamp ?? ''}|${alert.kind}`;
}

function pointKey(point: ChartPoint): string {
  return point.datumId == null ? `${point.x}|${point.y}` : `#${point.datumId}`;
}

/**
 * Merges alias data without counting one measurement twice.
 *
 * Two machine pools measuring the same push produce two distinct data points,
 * which is real history and is kept; the graph names both platforms instead.
 * What this rejects is the same datum arriving twice, so merging aliases stays
 * idempotent however the preset reaches a signature.
 */
function mergedPoints(
  left: readonly ChartPoint[],
  right: readonly ChartPoint[],
): ChartPoint[] {
  const byKey = new Map<string, ChartPoint>();
  for (const point of [...left, ...right]) {
    const key = pointKey(point);
    if (!byKey.has(key)) byKey.set(key, point);
  }
  return [...byKey.values()].sort((one, other) => one.x - other.x);
}

function mergedAlerts(
  left: readonly PerformanceAlert[] | undefined,
  right: readonly PerformanceAlert[] | undefined,
): PerformanceAlert[] {
  const byKey = new Map<string, PerformanceAlert>();
  for (const alert of [...(left ?? []), ...(right ?? [])]) {
    const key = alertKey(alert);
    if (!byKey.has(key)) byKey.set(key, alert);
  }
  return [...byKey.values()];
}

/** Combines Perfherder graph links without repeating a series parameter. */
function mergedPerfherderUrl(existing: string, incoming: string): string {
  const combined = new URL(existing);
  const combinedParams = new URLSearchParams(combined.hash.split('?')[1]);
  const incomingParams = new URLSearchParams(
    new URL(incoming).hash.split('?')[1],
  );
  const seen = new Set(combinedParams.getAll('series'));
  for (const value of incomingParams.getAll('series')) {
    if (seen.has(value)) continue;
    seen.add(value);
    combinedParams.append('series', value);
  }
  combined.hash = `/graphs?${combinedParams.toString()}`;
  return combined.toString();
}

export function combineSeriesResults(
  query: BenchmarkQuery,
  results: readonly SeriesQueryResult[],
): BenchmarkLoadResult {
  const graphs = new Map<string, GraphViewModel>();
  const errors: SeriesQueryFailure[] = [];
  // Aliased platforms report the same degradation, so warnings are deduplicated
  // to keep one cause from filling the diagnostics panel.
  const warnings = new Set<string>();
  const successfulSeries = new Set(
    results
      .filter((result) => result.status === 'success')
      .map((result) => logicalSeriesId(result.series)),
  );

  for (const result of results) {
    if (result.status !== 'success') {
      // A view can span old and replacement machine platforms so their data
      // merges into one logical series. Do not present a retired platform as a
      // broken browser when its equivalent succeeded on the replacement pool.
      if (!successfulSeries.has(logicalSeriesId(result.series))) {
        errors.push(result);
      }
      continue;
    }

    for (const warning of result.warnings ?? []) warnings.add(warning);

    for (const graph of result.graphs) {
      const title = query.includeSubtests
        ? graph.meta.test || query.label
        : query.label;
      const id = graphId(query.benchmarkId, title);
      const existing = graphs.get(id);
      const platform = graph.meta.machinePlatform ?? result.series.platform;
      const chartSeries: ChartSeries = {
        alerts: graph.alerts.map(chartAlert),
        color: result.series.color,
        data: graph.data.map((datum) => ({
          datumId: datum.datumId,
          jobId: datum.jobId,
          platform,
          pushId: datum.pushId,
          pushUrl: datum.pushUrl,
          revision: datum.revision,
          x: datum.timestamp,
          y: datum.value,
        })),
        label: result.series.label,
      };

      if (!existing) {
        graphs.set(id, {
          ...(query.docUrl ? { docUrl: query.docUrl } : {}),
          id,
          ...(graph.meta.lowerIsBetter == null
            ? {}
            : { lowerIsBetter: graph.meta.lowerIsBetter }),
          perfherderUrl: graph.perfherderUrl,
          project: result.series.project,
          series: [chartSeries],
          sources: [platform],
          title,
          yLabel: query.yLabel ?? yAxisLabelForSignature(graph.meta),
        });
        continue;
      }

      const sameLabel = existing.series.find(
        (series) => series.label === chartSeries.label,
      );
      if (sameLabel) {
        sameLabel.data = mergedPoints(sameLabel.data, chartSeries.data);
        sameLabel.alerts = mergedAlerts(sameLabel.alerts, chartSeries.alerts);
      } else {
        existing.series.push(chartSeries);
      }

      if (!existing.sources?.includes(platform)) {
        existing.sources = [...(existing.sources ?? []), platform];
      }
      existing.perfherderUrl = mergedPerfherderUrl(
        existing.perfherderUrl,
        graph.perfherderUrl,
      );
    }
  }

  return {
    benchmarkId: query.benchmarkId,
    errors,
    graphs: [...graphs.values()].sort((left, right) =>
      left.title.localeCompare(right.title),
    ),
    label: query.label,
    warnings: [...warnings],
  };
}

export async function loadBenchmark(
  query: BenchmarkQuery,
  days: number,
  signal: AbortSignal,
): Promise<BenchmarkLoadResult> {
  const results = await Promise.all(
    query.series.map((series) =>
      querySeries(series, {
        includeAlerts: query.includeAlerts,
        includeSubtests: query.includeSubtests,
        intervalSeconds: days * 24 * 60 * 60,
        signal,
      }),
    ),
  );
  return combineSeriesResults(query, results);
}
