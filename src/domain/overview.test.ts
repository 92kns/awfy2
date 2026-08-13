import { describe, expect, it } from 'vitest';
import type { BenchmarkLoadResult, GraphViewModel } from './types';
import {
  benchmarkDomain,
  groupOverviewResults,
  overviewMovers,
} from './overview';

const DAY = 86_400_000;

function result(
  benchmarkId: string,
  graph?: GraphViewModel,
): BenchmarkLoadResult {
  return {
    benchmarkId,
    errors: [],
    graphs: graph ? [graph] : [],
    label: benchmarkId,
    warnings: [],
  };
}

describe('overview organization', () => {
  it('groups curated benchmarks into stable performance domains', () => {
    expect(benchmarkDomain('raptor-desktop-speedometer3', 'Benchmarks')).toBe(
      'JavaScript',
    );
    expect(benchmarkDomain('rasterflood_svg', 'Benchmarks')).toBe(
      'Graphics & media',
    );
    expect(benchmarkDomain('tabpaint', 'Benchmarks')).toBe('Responsiveness');
    expect(
      groupOverviewResults(
        [result('speedometer3'), result('tabpaint'), result('rasterflood_svg')],
        'Benchmarks',
      ).map((group) => group.domain),
    ).toEqual(['Responsiveness', 'JavaScript', 'Graphics & media']);
  });

  it('ranks improvements and regressions by magnitude', () => {
    const now = Date.now();
    const graph: GraphViewModel = {
      id: 'speedometer',
      lowerIsBetter: false,
      perfherderUrl: 'https://example.test',
      series: [
        {
          color: '#f60',
          data: [
            { x: now - 8 * DAY, y: 20 },
            { x: now - 7 * DAY, y: 20 },
            { x: now - DAY, y: 22 },
            { x: now, y: 22 },
          ],
          label: 'Firefox',
        },
        {
          color: '#06f',
          data: [
            { x: now - 8 * DAY, y: 20 },
            { x: now - 7 * DAY, y: 20 },
            { x: now - DAY, y: 18 },
            { x: now, y: 18 },
          ],
          label: 'Chrome',
        },
      ],
      title: 'Speedometer',
      yLabel: 'Score',
    };
    const movers = overviewMovers([result('speedometer3', graph)], 30);
    expect(movers.improvements[0]).toMatchObject({
      percentage: 10,
      seriesLabel: 'Firefox',
    });
    expect(movers.regressions[0]).toMatchObject({
      percentage: -10,
      seriesLabel: 'Chrome',
    });
  });

  it('ignores sparse history and series that stopped reporting', () => {
    const now = 2_000 * DAY;
    const graph = (data: { x: number; y: number }[]): GraphViewModel => ({
      id: 'graph',
      lowerIsBetter: false,
      perfherderUrl: 'https://example.test',
      series: [{ color: '#f60', data, label: 'Firefox' }],
      title: 'Graph',
      yLabel: 'Score',
    });

    // Two samples a year apart are not a seven-day change.
    expect(
      overviewMovers(
        [
          result(
            'sparse',
            graph([
              { x: now - 300 * DAY, y: 10 },
              { x: now, y: 20 },
            ]),
          ),
        ],
        30,
        3,
        now,
      ),
    ).toEqual({ improvements: [], regressions: [] });

    // A real change that stopped reporting weeks ago is not a recent mover.
    expect(
      overviewMovers(
        [
          result(
            'stale',
            graph([
              { x: now - 40 * DAY, y: 10 },
              { x: now - 33 * DAY, y: 20 },
            ]),
          ),
        ],
        30,
        3,
        now,
      ),
    ).toEqual({ improvements: [], regressions: [] });
  });

  it('does not rank a one-point spike as a largest mover', () => {
    const now = 2_000 * DAY;
    const graph: GraphViewModel = {
      id: 'spike',
      lowerIsBetter: false,
      perfherderUrl: 'https://example.test',
      series: [
        {
          color: '#f60',
          data: [
            { x: now - 8 * DAY, y: 100 },
            { x: now - 7 * DAY, y: 100 },
            { x: now, y: 1_000 },
          ],
          label: 'Firefox',
        },
      ],
      title: 'Spike',
      yLabel: 'Score',
    };

    expect(overviewMovers([result('spike', graph)], 30, 3, now)).toEqual({
      improvements: [],
      regressions: [],
    });
  });
});
