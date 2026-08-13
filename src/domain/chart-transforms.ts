import type { ChartPoint, ChartSeries } from './types';
import { DAY_MS } from './chart-metrics';

/** A daily series can be sampled on either side of a timestamp. */
export const DEFAULT_BASELINE_TOLERANCE_MS = 36 * 60 * 60 * 1000;

function sortedPoints(points: readonly ChartPoint[]): ChartPoint[] {
  return [...points].sort((left, right) => left.x - right.x);
}

export function median(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

/**
 * Produces one median point per source point.  Inputs are copied before both
 * sorting and emitting so they are safe to pass across the Chart.js boundary.
 */
export function rollingMedian(
  points: readonly ChartPoint[],
  windowSize = 7,
): ChartPoint[] {
  if (!Number.isInteger(windowSize) || windowSize < 1) {
    throw new RangeError(
      'rolling median windowSize must be a positive integer',
    );
  }
  const ordered = sortedPoints(points);
  return ordered.map((point, index) => ({
    ...point,
    y: median(
      ordered
        .slice(Math.max(0, index - windowSize + 1), index + 1)
        .map((candidate) => candidate.y),
    )!,
  }));
}

export function nearestPointWithinTolerance(
  points: readonly ChartPoint[],
  timestamp: number,
  toleranceMs = DEFAULT_BASELINE_TOLERANCE_MS,
): ChartPoint | undefined {
  let nearest: ChartPoint | undefined;
  for (const point of points) {
    const distance = Math.abs(point.x - timestamp);
    if (
      distance > toleranceMs ||
      (nearest && distance > Math.abs(nearest.x - timestamp)) ||
      (nearest &&
        distance === Math.abs(nearest.x - timestamp) &&
        point.x < nearest.x)
    ) {
      continue;
    }
    nearest = point;
  }
  return nearest;
}

/**
 * Aligns every series with its named baseline by timestamp and expresses the
 * value as a percent difference.  Points without a nearby baseline sample are
 * deliberately omitted instead of implying a comparison that did not happen.
 */
export function relativeToBaselinePercent(
  series: readonly ChartSeries[],
  baselineLabel: string | null | undefined,
  toleranceMs = DEFAULT_BASELINE_TOLERANCE_MS,
): ChartSeries[] {
  const baseline = series.find(
    (candidate) => candidate.label === baselineLabel,
  );
  if (!baseline) {
    return series.map((candidate) => ({
      ...candidate,
      data: candidate.data.map((point) => ({ ...point })),
    }));
  }
  const baselinePoints = sortedPoints(baseline.data);

  return series.map((candidate) => ({
    ...candidate,
    data: sortedPoints(candidate.data).flatMap((point) => {
      const baselinePoint = nearestPointWithinTolerance(
        baselinePoints,
        point.x,
        toleranceMs,
      );
      if (!baselinePoint || baselinePoint.y === 0) return [];
      return [
        {
          ...point,
          y: ((point.y - baselinePoint.y) / baselinePoint.y) * 100,
        },
      ];
    }),
  }));
}

export { DAY_MS };
