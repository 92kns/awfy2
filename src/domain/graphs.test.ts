import { describe, expect, it } from 'vitest';
import type {
  BenchmarkQuery,
  ResolvedSeries,
  SeriesQueryResult,
  SeriesQuerySuccess,
  Signature,
} from './types';
import { combineSeriesResults } from './graphs';

const firefox: ResolvedSeries = {
  color: '#f60',
  frameworkId: 13,
  label: 'Firefox',
  option: 'opt',
  platform: 'linux-a',
  suite: 'speedometer3',
};

const query: BenchmarkQuery = {
  benchmarkId: 'speedometer3',
  includeAlerts: true,
  includeSubtests: false,
  label: 'Speedometer 3',
  series: [firefox],
};

const meta: Signature = {
  frameworkId: 13,
  hasSubtests: false,
  id: 1,
  lowerIsBetter: false,
  optionCollectionHash: 'hash',
  signatureHash: 'sig',
  suite: 'speedometer3',
  test: 'speedometer3',
};

function success(
  series: ResolvedSeries,
  id: number,
  timestamp: number,
): SeriesQueryResult {
  return {
    graphs: [
      {
        alerts: [],
        data: [
          {
            datumId: id,
            jobId: id,
            pushId: id,
            pushUrl: `https://treeherder.mozilla.org/jobs?repo=autoland&revision=${id}`,
            revision: String(id),
            timestamp,
            value: id * 10,
          },
        ],
        meta: { ...meta, id, signatureHash: `sig-${id}` },
        perfherderUrl: `https://treeherder.mozilla.org/perf.html#/graphs?timerange=10&series=autoland%2C${id}%2C1%2C13`,
      },
    ],
    series,
    status: 'success',
  };
}

describe('graph view-model assembly', () => {
  it('merges data for the same label across platforms in time order', () => {
    const results = [
      success({ ...firefox, platform: 'linux-a' }, 1, 2000),
      success({ ...firefox, platform: 'linux-b' }, 2, 1000),
    ];
    const combined = combineSeriesResults(query, results);

    expect(combined.graphs).toHaveLength(1);
    expect(combined.graphs[0]!.series).toHaveLength(1);
    expect(combined.graphs[0]!.series[0]!.data.map((point) => point.x)).toEqual(
      [1000, 2000],
    );
    expect(
      new URL(combined.graphs[0]!.perfherderUrl).hash.match(/series=/g),
    ).toHaveLength(2);
  });

  it('keeps successful graphs when another series fails', () => {
    const failure: SeriesQueryResult = {
      message: 'missing',
      series: { ...firefox, label: 'Chrome' },
      status: 'not-found',
    };
    const combined = combineSeriesResults(query, [
      success(firefox, 1, 1000),
      failure,
    ]);
    expect(combined.graphs).toHaveLength(1);
    expect(combined.errors).toEqual([failure]);
  });

  it('suppresses a retired platform failure when its replacement succeeds', () => {
    const failure: SeriesQueryResult = {
      message: 'missing',
      series: { ...firefox, platform: 'windows11-old' },
      status: 'not-found',
    };
    const replacement = success(
      { ...firefox, platform: 'windows11-replacement' },
      1,
      1000,
    );

    const combined = combineSeriesResults(query, [failure, replacement]);

    expect(combined.graphs).toHaveLength(1);
    expect(combined.errors).toEqual([]);
  });

  it('does not double-count a push reported by two machine pools', () => {
    const first = success({ ...firefox, platform: 'windows11-old' }, 1, 1000);
    const duplicate = success(
      { ...firefox, platform: 'windows11-24h2' },
      1,
      1000,
    );
    const combined = combineSeriesResults(query, [first, duplicate]);

    const [graph] = combined.graphs;
    expect(graph!.series[0]!.data).toHaveLength(1);
    expect(graph!.sources).toEqual(['windows11-old', 'windows11-24h2']);
  });

  it('keeps the merged Perfherder link free of repeated series parameters', () => {
    const repeated = combineSeriesResults(query, [
      success({ ...firefox, platform: 'windows11-old' }, 1, 1000),
      success({ ...firefox, platform: 'windows11-24h2' }, 1, 2000),
    ]);
    expect(
      new URL(repeated.graphs[0]!.perfherderUrl).hash.match(/series=/g),
    ).toHaveLength(1);
  });

  it('labels the axis with the unit Treeherder reports', () => {
    const bytes = success(firefox, 1, 1000);
    if (bytes.status !== 'success') throw new Error('unreachable');
    bytes.graphs[0]!.meta = {
      ...bytes.graphs[0]!.meta,
      lowerIsBetter: true,
      measurementUnit: 'bytes',
    };
    expect(combineSeriesResults(query, [bytes]).graphs[0]!.yLabel).toBe(
      'Bytes',
    );

    const unitless = success(firefox, 2, 1000);
    if (unitless.status !== 'success') throw new Error('unreachable');
    unitless.graphs[0]!.meta = {
      ...unitless.graphs[0]!.meta,
      lowerIsBetter: true,
    };
    expect(combineSeriesResults(query, [unitless]).graphs[0]!.yLabel).toBe(
      'Value',
    );
  });

  it('signs an alert from the values it moved between, not from amountPct', () => {
    const withAlert = success(firefox, 1, 1000);
    if (withAlert.status !== 'success') throw new Error('unreachable');
    withAlert.graphs[0]!.alerts = [
      {
        alertId: 9,
        alertStatus: 2,
        // Treeherder reports magnitudes, so an improvement is also positive.
        amountPct: 4.5,
        isRegression: false,
        newValue: 9,
        prevValue: 10,
        relatedSummaryId: 4321,
        revision: 'alert-revision',
        seriesSignatureId: 1,
        summaryId: 1234,
        summaryStatus: 0,
        timestamp: 1000,
      },
    ];

    const [alert] = combineSeriesResults(query, [withAlert]).graphs[0]!
      .series[0]!.alerts!;
    expect(alert!.summary).toBe('Improvement (−4.50%)');
    expect(alert!.revision).toBe('alert-revision');
    expect(alert!.url).toBe(
      'https://treeherder.mozilla.org/perfherder/alerts?id=4321',
    );
  });

  it('deduplicates the same non-fatal warning reported by aliased platforms', () => {
    const alertsDown = 'Regression and improvement markers are unavailable.';
    const warned = (
      platform: string,
      id: number,
      timestamp: number,
    ): SeriesQuerySuccess => {
      const base = success({ ...firefox, platform }, id, timestamp);
      if (base.status !== 'success') throw new Error('unreachable');
      return { ...base, warnings: [alertsDown] };
    };

    const combined = combineSeriesResults(query, [
      warned('linux-a', 1, 1000),
      warned('linux-b', 2, 2000),
    ]);

    expect(combined.warnings).toEqual([alertsDown]);
  });

  it('reports no warnings when every series is fully enriched', () => {
    expect(
      combineSeriesResults(query, [success(firefox, 1, 1000)]).warnings,
    ).toEqual([]);
  });

  it('keeps a failure when only a different browser succeeds', () => {
    const failure: SeriesQueryResult = {
      message: 'missing',
      series: { ...firefox, platform: 'windows11-old' },
      status: 'not-found',
    };
    const chrome = success(
      {
        ...firefox,
        application: 'chrome',
        label: 'Chrome',
        platform: 'windows11-replacement',
      },
      2,
      1000,
    );

    expect(combineSeriesResults(query, [failure, chrome]).errors).toEqual([
      failure,
    ]);
  });
});
