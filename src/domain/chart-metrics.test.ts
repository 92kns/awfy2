import { describe, expect, it } from 'vitest';
import {
  DAY_MS,
  comparisonDays,
  freshnessForTimestamp,
  improvementDirection,
  nearestEarlierPoint,
  seriesMetrics,
} from './chart-metrics';
import type { ChartSeries } from './types';

const now = 2_000 * DAY_MS;

function series(data: ChartSeries['data']): ChartSeries {
  return { color: '#f60', data, label: 'Firefox' };
}

describe('chart series metrics', () => {
  it('uses a seven-day comparison for ranges through thirty days', () => {
    expect(comparisonDays(1)).toBe(7);
    expect(comparisonDays(30)).toBe(7);
    expect(comparisonDays(31)).toBe(30);
  });

  it('computes the latest value, freshness, link, and improving lower-is-better delta', () => {
    const metrics = seriesMetrics(
      series([
        { x: now - 10 * DAY_MS, y: 120 },
        { x: now - 7 * DAY_MS, y: 110 },
        {
          jobId: 44,
          revision: 'abcdef1234567890',
          revisionUrl: 'https://treeherder.mozilla.org/jobs?revision=abcdef',
          x: now - DAY_MS,
          y: 100,
        },
      ]),
      { days: 30, lowerIsBetter: true, now },
    );

    expect(metrics.pointCount).toBe(3);
    expect(metrics.latest?.y).toBe(100);
    expect(metrics.latestValue).toBe(100);
    expect(metrics.lastTimestamp).toBe(now - DAY_MS);
    expect(metrics.freshness).toBe('fresh');
    expect(metrics.latestRevision).toBe('abcdef1234567890');
    expect(metrics.latestJobId).toBe(44);
    expect(metrics.latestLink).toEqual({
      label: 'Revision abcdef123456',
      url: 'https://treeherder.mozilla.org/jobs?revision=abcdef',
    });
    expect(metrics.delta).toMatchObject({
      comparisonValue: 110,
      direction: 'improved',
      value: -10,
    });
  });

  it('uses the nearest thirty-day point and honours higher-is-better values', () => {
    const metrics = seriesMetrics(
      series([
        { x: now - 32 * DAY_MS, y: 90 },
        { x: now - 29 * DAY_MS, y: 95 },
        { x: now - DAY_MS, y: 100 },
      ]),
      { days: 90, lowerIsBetter: false, now },
    );

    expect(metrics.delta).toMatchObject({
      comparisonValue: 90,
      direction: 'improved',
      value: 10,
    });
  });

  it('does not mutate, or compare against, a duplicate latest point', () => {
    const points = [
      { x: now - 7 * DAY_MS, y: 10 },
      { x: now - DAY_MS, y: 8 },
      { x: now - DAY_MS, y: 7 },
    ];
    const snapshot = structuredClone(points);

    expect(nearestEarlierPoint(points, now - 8 * DAY_MS, now - DAY_MS)).toEqual(
      points[0],
    );
    expect(seriesMetrics(series(points), { days: 30, now }).latest?.y).toBe(7);
    expect(points).toEqual(snapshot);
  });

  it('makes the improvement semantics explicit when direction is unavailable', () => {
    expect(improvementDirection(2, false)).toBe('improved');
    expect(improvementDirection(2, true)).toBe('regressed');
    expect(improvementDirection(-2, true)).toBe('improved');
    expect(improvementDirection(0, undefined)).toBe('unchanged');
    expect(improvementDirection(2, undefined)).toBe('unknown');
  });

  it('reports absent and old data as unknown or stale', () => {
    expect(freshnessForTimestamp(undefined, now)).toBe('unknown');
    expect(freshnessForTimestamp(now - 3 * DAY_MS, now)).toBe('aging');
    expect(freshnessForTimestamp(now - 8 * DAY_MS, now)).toBe('stale');
  });
});
