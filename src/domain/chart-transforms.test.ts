import { describe, expect, it } from 'vitest';
import {
  DAY_MS,
  DEFAULT_BASELINE_TOLERANCE_MS,
  median,
  nearestPointWithinTolerance,
  relativeToBaselinePercent,
  rollingMedian,
} from './chart-transforms';
import type { ChartSeries } from './types';

describe('chart data transforms', () => {
  it('calculates rolling medians from chronologically sorted copies', () => {
    const points = [
      { x: 3, y: 9 },
      { x: 1, y: 4 },
      { x: 2, y: 1 },
    ];
    const snapshot = structuredClone(points);

    expect(rollingMedian(points, 3)).toEqual([
      { x: 1, y: 4 },
      { x: 2, y: 2.5 },
      { x: 3, y: 4 },
    ]);
    expect(points).toEqual(snapshot);
    expect(median([9, 1, 3, 7])).toBe(5);
  });

  it('rejects an invalid rolling-median window', () => {
    expect(() => rollingMedian([], 0)).toThrow(RangeError);
    expect(() => rollingMedian([], 1.5)).toThrow(RangeError);
  });

  it('matches the closest baseline point inside the timestamp tolerance', () => {
    const baseline = [
      { x: 0, y: 100 },
      { x: DAY_MS, y: 120 },
    ];
    expect(
      nearestPointWithinTolerance(baseline, DAY_MS + 6 * 60 * 60 * 1000),
    ).toEqual(baseline[1]);
    expect(
      nearestPointWithinTolerance(
        baseline,
        DAY_MS + DEFAULT_BASELINE_TOLERANCE_MS + 1,
      ),
    ).toBeUndefined();
  });

  it('expresses points relative to their nearest baseline sample without mutation', () => {
    const source: ChartSeries[] = [
      {
        color: '#f60',
        data: [
          { x: 0, y: 100 },
          { x: DAY_MS, y: 120 },
          { x: 2 * DAY_MS, y: 0 },
        ],
        label: 'Firefox',
      },
      {
        color: '#0af',
        data: [
          { x: 3 * 60 * 60 * 1000, y: 110 },
          { x: DAY_MS + 2 * 60 * 60 * 1000, y: 90 },
          { x: 5 * DAY_MS, y: 50 },
        ],
        label: 'Chrome',
      },
    ];
    const snapshot = structuredClone(source);

    const transformed = relativeToBaselinePercent(source, 'Firefox');

    expect(transformed[0]!.data.map((point) => point.y)).toEqual([0, 0]);
    expect(transformed[1]!.data.map((point) => point.y)).toEqual([10, -25]);
    expect(source).toEqual(snapshot);
  });

  it('preserves copied values when no baseline is selected', () => {
    const source: ChartSeries[] = [
      { color: '#f60', data: [{ x: 1, y: 2 }], label: 'Firefox' },
    ];
    const result = relativeToBaselinePercent(source, null);
    expect(result).toEqual(source);
    expect(result).not.toBe(source);
    expect(result[0]!.data).not.toBe(source[0]!.data);
  });
});
