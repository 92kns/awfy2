import type {
  BenchmarkLoadResult,
  BenchmarkQuery,
  ChartSeries,
  GraphViewModel,
  SeriesQueryFailure,
  SeriesQueryResult,
} from './types';
import { querySeries } from '../treeherder/client';

function graphId(title: string, test: string): string {
  return `${title}::${test}`;
}

export function combineSeriesResults(
  query: BenchmarkQuery,
  results: readonly SeriesQueryResult[],
): BenchmarkLoadResult {
  const graphs = new Map<string, GraphViewModel>();
  const errors: SeriesQueryFailure[] = [];

  for (const result of results) {
    if (result.status !== 'success') {
      errors.push(result);
      continue;
    }

    for (const graph of result.graphs) {
      const title = query.includeSubtests
        ? graph.meta.test || query.label
        : query.label;
      const id = graphId(query.benchmarkId, title);
      const existing = graphs.get(id);
      const chartSeries: ChartSeries = {
        color: result.series.color,
        data: graph.data.map((datum) => ({
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
          series: [chartSeries],
          title,
          yLabel:
            query.yLabel ??
            (graph.meta.lowerIsBetter === false
              ? 'Score'
              : 'Execution time (ms)'),
        });
        continue;
      }

      const sameLabel = existing.series.find(
        (series) => series.label === chartSeries.label,
      );
      if (sameLabel) {
        sameLabel.data = [...sameLabel.data, ...chartSeries.data].sort(
          (left, right) => left.x - right.x,
        );
      } else {
        existing.series.push(chartSeries);
      }

      const incoming = new URL(graph.perfherderUrl).hash.split('?')[1];
      const incomingParams = new URLSearchParams(incoming);
      const combined = new URL(existing.perfherderUrl);
      const combinedParams = new URLSearchParams(combined.hash.split('?')[1]);
      for (const value of incomingParams.getAll('series')) {
        combinedParams.append('series', value);
      }
      combined.hash = `/graphs?${combinedParams.toString()}`;
      existing.perfherderUrl = combined.toString();
    }
  }

  return {
    benchmarkId: query.benchmarkId,
    errors,
    graphs: [...graphs.values()].sort((left, right) =>
      left.title.localeCompare(right.title),
    ),
    label: query.label,
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
        includeSubtests: query.includeSubtests,
        intervalSeconds: days * 24 * 60 * 60,
        signal,
      }),
    ),
  );
  return combineSeriesResults(query, results);
}
