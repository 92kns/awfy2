import { describe, expect, it } from 'vitest';
import {
  alertTooltipText,
  effectiveBaseline,
  pointTreeherderUrl,
  prepareChartSeries,
  shouldReverseYAxis,
  yAxisLabel,
} from './chart-options';
import type { ChartSeries } from '../domain/types';

describe('chart axis direction', () => {
  it('puts better results toward the top of the chart', () => {
    expect(shouldReverseYAxis(false)).toBe(false);
    expect(shouldReverseYAxis(true)).toBe(true);
    expect(shouldReverseYAxis(undefined)).toBe(false);
  });
});

const series: ChartSeries[] = [
  {
    color: '#f60',
    data: [
      { x: 0, y: 100 },
      {
        alert: { kind: 'regression', summary: 'p95 regression' },
        x: 1,
        y: 120,
      },
    ],
    label: 'Firefox',
  },
  {
    color: '#0af',
    data: [
      { x: 0, y: 110 },
      { x: 1, y: 90 },
    ],
    label: 'Chrome',
  },
];

describe('chart display options', () => {
  it('defaults to scatter and prepares a line in trend mode', () => {
    expect(prepareChartSeries(series)).toHaveLength(2);
    expect(prepareChartSeries(series, { chartMode: 'trend' })[0]!.kind).toBe(
      'points',
    );
  });

  it('adds an independent rolling-median overlay per source series', () => {
    const prepared = prepareChartSeries(series, { chartMode: 'median' });
    expect(prepared.map((dataset) => dataset.label)).toEqual([
      'Firefox',
      'Firefox median',
      'Chrome',
      'Chrome median',
    ]);
    expect(prepared[1]!.data.map((point) => point.y)).toEqual([100, 110]);
  });

  it('aligns relative values to the selected (or first) baseline', () => {
    const prepared = prepareChartSeries(series, {
      baseline: 'Firefox',
      valueMode: 'relative',
    });
    expect(prepared[0]!.data.map((point) => point.y)).toEqual([0, 0]);
    expect(prepared[1]!.data.map((point) => point.y)).toEqual([10, -25]);
    expect(effectiveBaseline(series, null)).toBe('Firefox');
    expect(yAxisLabel('Milliseconds', 'absolute', 'Firefox')).toBe(
      'Milliseconds',
    );
    expect(yAxisLabel('Milliseconds', 'relative', 'Firefox')).toBe(
      '% vs Firefox',
    );
  });

  it('creates revision URLs and useful alert tooltip text', () => {
    expect(
      pointTreeherderUrl({ revision: 'abc123', x: 1, y: 2 }, 'autoland'),
    ).toBe('https://treeherder.mozilla.org/jobs?repo=autoland&revision=abc123');
    expect(alertTooltipText(series[0]!.data[1]!.alert)).toBe(
      'Regression: p95 regression',
    );
  });
});
