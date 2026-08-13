import type { ChartPoint, ChartSeries } from './types';

export const DAY_MS = 24 * 60 * 60 * 1000;

export type FreshnessStatus = 'unknown' | 'fresh' | 'aging' | 'stale';

export type ImprovementDirection =
  'improved' | 'regressed' | 'unchanged' | 'unknown';

export interface SeriesDelta {
  comparisonTimestamp: number;
  comparisonValue: number;
  direction: ImprovementDirection;
  percentage?: number | undefined;
  targetTimestamp: number;
  value: number;
}

export interface LatestReference {
  label: string;
  url: string;
}

export interface SeriesMetrics {
  delta?: SeriesDelta | undefined;
  freshness: FreshnessStatus;
  latest?: ChartPoint | undefined;
  latestJobId?: number | string | undefined;
  latestLink?: LatestReference | undefined;
  latestRevision?: string | undefined;
  latestValue?: number | undefined;
  lastTimestamp?: number | undefined;
  pointCount: number;
}

export interface SeriesMetricOptions {
  /** The range shown in the chart, used to choose a seven or thirty-day delta. */
  days: number;
  lowerIsBetter?: boolean | undefined;
  now?: number | undefined;
}

function latestPoint(points: readonly ChartPoint[]): ChartPoint | undefined {
  let latest: ChartPoint | undefined;
  for (const point of points) {
    if (!latest || point.x >= latest.x) latest = point;
  }
  return latest;
}

/** Seven days for shorter views, otherwise one calendar-ish month. */
export function comparisonDays(days: number): number {
  return days <= 30 ? 7 : 30;
}

export function freshnessForTimestamp(
  timestamp: number | undefined,
  now = Date.now(),
): FreshnessStatus {
  if (timestamp == null) return 'unknown';
  const age = Math.max(0, now - timestamp);
  if (age <= 2 * DAY_MS) return 'fresh';
  if (age <= 7 * DAY_MS) return 'aging';
  return 'stale';
}

export function improvementDirection(
  delta: number,
  lowerIsBetter: boolean | undefined,
): ImprovementDirection {
  if (delta === 0) return 'unchanged';
  if (lowerIsBetter == null) return 'unknown';
  const improved = lowerIsBetter ? delta < 0 : delta > 0;
  return improved ? 'improved' : 'regressed';
}

/**
 * How far a comparison point may sit from the requested historical timestamp.
 *
 * Without a tolerance a series holding only two distant samples reports the
 * gap between them as a seven-day change, which then ranks as a large mover.
 */
export function comparisonToleranceMs(days: number): number {
  return (comparisonDays(days) / 2) * DAY_MS;
}

/**
 * Finds the point nearest the requested historical timestamp.  The candidate
 * must predate the latest point so a duplicate current timestamp cannot become
 * its own comparison.
 */
export function nearestEarlierPoint(
  points: readonly ChartPoint[],
  targetTimestamp: number,
  latestTimestamp: number,
  toleranceMs = Number.POSITIVE_INFINITY,
): ChartPoint | undefined {
  let nearest: ChartPoint | undefined;
  for (const point of points) {
    if (point.x >= latestTimestamp) continue;
    if (Math.abs(point.x - targetTimestamp) > toleranceMs) continue;
    if (
      !nearest ||
      Math.abs(point.x - targetTimestamp) <
        Math.abs(nearest.x - targetTimestamp) ||
      (Math.abs(point.x - targetTimestamp) ===
        Math.abs(nearest.x - targetTimestamp) &&
        point.x > nearest.x)
    ) {
      nearest = point;
    }
  }
  return nearest;
}

function latestReference(
  point: ChartPoint | undefined,
): LatestReference | undefined {
  if (!point) return undefined;
  const url = point.revisionUrl ?? point.pushUrl;
  if (!url) return undefined;
  if (point.revision) {
    return { label: `Revision ${point.revision.slice(0, 12)}`, url };
  }
  if (point.jobId != null) return { label: `Job ${point.jobId}`, url };
  if (point.pushId != null) return { label: `Push ${point.pushId}`, url };
  return { label: 'Latest push', url };
}

export function seriesMetrics(
  series: Pick<ChartSeries, 'data'>,
  options: SeriesMetricOptions,
): SeriesMetrics {
  const latest = latestPoint(series.data);
  const lastTimestamp = latest?.x;
  const days = comparisonDays(options.days);
  const targetTimestamp =
    lastTimestamp == null ? undefined : lastTimestamp - days * DAY_MS;
  const comparison =
    latest && targetTimestamp != null
      ? nearestEarlierPoint(
          series.data,
          targetTimestamp,
          latest.x,
          comparisonToleranceMs(options.days),
        )
      : undefined;
  const delta =
    latest && comparison && targetTimestamp != null
      ? {
          comparisonTimestamp: comparison.x,
          comparisonValue: comparison.y,
          direction: improvementDirection(
            latest.y - comparison.y,
            options.lowerIsBetter,
          ),
          ...(comparison.y === 0
            ? {}
            : { percentage: ((latest.y - comparison.y) / comparison.y) * 100 }),
          targetTimestamp,
          value: latest.y - comparison.y,
        }
      : undefined;
  const link = latestReference(latest);

  return {
    ...(delta ? { delta } : {}),
    freshness: freshnessForTimestamp(lastTimestamp, options.now),
    ...(latest ? { latest } : {}),
    ...(latest?.jobId == null ? {} : { latestJobId: latest.jobId }),
    ...(link ? { latestLink: link } : {}),
    ...(latest?.revision ? { latestRevision: latest.revision } : {}),
    ...(latest ? { latestValue: latest.y } : {}),
    ...(lastTimestamp == null ? {} : { lastTimestamp }),
    pointCount: series.data.length,
  };
}
