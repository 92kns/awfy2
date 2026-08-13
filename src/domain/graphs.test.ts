import { describe, expect, it } from 'vitest';
import type {
  BenchmarkQuery,
  ResolvedSeries,
  SeriesQueryResult,
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
        data: [{ datumId: id, timestamp, value: id * 10 }],
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
