import {
  comparisonDays,
  DAY_MS,
  improvementDirection,
  type ImprovementDirection,
} from './chart-metrics';
import { median } from './chart-transforms';
import type { BenchmarkLoadResult } from './types';

export type PerformanceDomain =
  | 'JavaScript'
  | 'Responsiveness'
  | 'Graphics & media'
  | 'Memory'
  | 'Network'
  | 'Page load'
  | 'Other';

const DOMAIN_ORDER: readonly PerformanceDomain[] = [
  'Responsiveness',
  'JavaScript',
  'Graphics & media',
  'Page load',
  'Memory',
  'Network',
  'Other',
];

export interface OverviewGroup {
  domain: PerformanceDomain;
  results: BenchmarkLoadResult[];
}

export interface OverviewMover {
  benchmarkId: string;
  benchmarkLabel: string;
  direction: Exclude<ImprovementDirection, 'unknown' | 'unchanged'>;
  percentage: number;
  seriesLabel: string;
}

export interface OverviewMovers {
  improvements: OverviewMover[];
  regressions: OverviewMover[];
}

const MOVER_WINDOW_MS = 2 * DAY_MS;
const MIN_MOVER_SAMPLES = 2;

function robustMoverChange(
  data: readonly { x: number; y: number }[],
  days: number,
  lowerIsBetter: boolean | undefined,
): { direction: ImprovementDirection; percentage: number } | undefined {
  const latestTimestamp = Math.max(...data.map((point) => point.x));
  if (!Number.isFinite(latestTimestamp)) return undefined;
  const comparisonTimestamp = latestTimestamp - comparisonDays(days) * DAY_MS;
  const latestValues = data
    .filter(
      (point) =>
        point.x <= latestTimestamp &&
        point.x >= latestTimestamp - MOVER_WINDOW_MS,
    )
    .map((point) => point.y);
  const comparisonValues = data
    .filter(
      (point) => Math.abs(point.x - comparisonTimestamp) <= MOVER_WINDOW_MS,
    )
    .map((point) => point.y);
  if (
    latestValues.length < MIN_MOVER_SAMPLES ||
    comparisonValues.length < MIN_MOVER_SAMPLES
  ) {
    return undefined;
  }
  const latestMedian = median(latestValues);
  const comparisonMedian = median(comparisonValues);
  if (
    latestMedian == null ||
    comparisonMedian == null ||
    comparisonMedian === 0
  ) {
    return undefined;
  }
  const delta = latestMedian - comparisonMedian;
  return {
    direction: improvementDirection(delta, lowerIsBetter),
    percentage: (delta / comparisonMedian) * 100,
  };
}

export function benchmarkDomain(
  benchmarkId: string,
  categoryLabel: string,
): PerformanceDomain {
  const category = categoryLabel.toLocaleLowerCase();
  if (category.includes('memory')) return 'Memory';
  if (category.includes('network')) return 'Network';
  if (category.includes('page load')) return 'Page load';

  if (
    /speedometer|jetstream|ares|octane|sunspider|six-speed|web-tooling|assorted-dom|stylebench|matrix-react|kraken|wasm/.test(
      benchmarkId,
    )
  ) {
    return 'JavaScript';
  }
  if (
    /motionmark|unity|webaudio|raster|displaylist|glvideo|tsvg/.test(
      benchmarkId,
    )
  ) {
    return 'Graphics & media';
  }
  if (/tab|sessionrestore|paint|tart|tp5o/.test(benchmarkId)) {
    return 'Responsiveness';
  }
  return 'Other';
}

export function groupOverviewResults(
  results: readonly BenchmarkLoadResult[],
  categoryLabel: string,
): OverviewGroup[] {
  const groups = new Map<PerformanceDomain, BenchmarkLoadResult[]>();
  for (const result of results) {
    const domain = benchmarkDomain(result.benchmarkId, categoryLabel);
    groups.set(domain, [...(groups.get(domain) ?? []), result]);
  }
  return DOMAIN_ORDER.flatMap((domain) => {
    const entries = groups.get(domain);
    return entries?.length ? [{ domain, results: entries }] : [];
  });
}

export function overviewMovers(
  results: readonly BenchmarkLoadResult[],
  days: number,
  limit = 3,
  now = Date.now(),
): OverviewMovers {
  // A change is only "recent" if the series still reports data. Ranking a
  // months-old step as a top mover would misdirect triage.
  const freshEnough = now - 3 * DAY_MS;
  const movers = results.flatMap((result) => {
    const graph = result.graphs[0];
    if (!graph) return [];
    return graph.series.flatMap((series) => {
      const lastTimestamp = Math.max(...series.data.map((point) => point.x));
      if (!Number.isFinite(lastTimestamp) || lastTimestamp < freshEnough) {
        return [];
      }
      const delta = robustMoverChange(series.data, days, graph.lowerIsBetter);
      if (
        delta?.percentage == null ||
        (delta.direction !== 'improved' && delta.direction !== 'regressed')
      ) {
        return [];
      }
      return [
        {
          benchmarkId: result.benchmarkId,
          benchmarkLabel: result.label,
          direction: delta.direction,
          percentage: delta.percentage,
          seriesLabel: series.label,
        } satisfies OverviewMover,
      ];
    });
  });
  const byMagnitude = (left: OverviewMover, right: OverviewMover) =>
    Math.abs(right.percentage) - Math.abs(left.percentage);
  return {
    improvements: movers
      .filter((mover) => mover.direction === 'improved')
      .sort(byMagnitude)
      .slice(0, limit),
    regressions: movers
      .filter((mover) => mover.direction === 'regressed')
      .sort(byMagnitude)
      .slice(0, limit),
  };
}
