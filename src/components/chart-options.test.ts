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
        alert: {
          kind: 'regression',
          summary: 'p95 regression',
          timestamp: 1,
        },
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

  it('never shows absolute values under a percentage axis', () => {
    // A shared URL can name a baseline this graph does not contain.
    expect(effectiveBaseline(series, 'Safari')).toBe('Firefox');

    const prepared = prepareChartSeries(series, {
      baseline: 'Safari',
      valueMode: 'relative',
    });
    const baseline = effectiveBaseline(series, 'Safari');
    expect(prepared[0]!.data.map((point) => point.y)).toEqual([0, 0]);
    expect(prepared[1]!.data.map((point) => point.y)).toEqual([10, -25]);
    expect(yAxisLabel('Milliseconds', 'relative', baseline)).toBe(
      '% vs Firefox',
    );
  });

  it('matches an alert to its push revision before its timestamp', () => {
    const withRevisions: ChartSeries[] = [
      {
        alerts: [
          {
            kind: 'regression',
            revision: 'push-two',
            summary: 'Regression (+8.94%)',
            timestamp: 5,
            url: 'https://treeherder.mozilla.org/perfherder/alerts?id=7',
          },
        ],
        color: '#f60',
        data: [
          { revision: 'push-one', x: 1, y: 100 },
          { revision: 'push-two', x: 2, y: 120 },
        ],
        label: 'Firefox',
      },
    ];

    const [prepared] = prepareChartSeries(withRevisions);
    expect(prepared!.data[0]!.alert).toBeUndefined();
    expect(prepared!.data[1]!.alert?.url).toBe(
      'https://treeherder.mozilla.org/perfherder/alerts?id=7',
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
