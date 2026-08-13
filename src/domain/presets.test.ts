import { describe, expect, it } from 'vitest';
import preset from '../presets/awfy';
import {
  buildBenchmarkQueries,
  resolveSeries,
  validatePresetReferences,
} from './presets';

describe('AWFY preset', () => {
  it('only references defined benchmarks', () => {
    const errors = Object.values(preset.config.views).flatMap((view) =>
      validatePresetReferences(preset.benchmarks, view.categories),
    );
    expect(errors).toEqual([]);
  });

  it('expands a configured series across every view platform', () => {
    const view = preset.config.views.linux64!;
    const queries = buildBenchmarkQueries(
      preset.benchmarks,
      view,
      'rasterflood_svg',
      'benchmarks',
    );

    expect(queries).toHaveLength(1);
    expect(queries[0]!.series.map((series) => series.platform)).toEqual([
      'linux64-shippable',
      'linux1804-64-shippable-qr',
    ]);
    expect(queries[0]!.includeSubtests).toBe(false);

    const subtestQueries = buildBenchmarkQueries(
      preset.benchmarks,
      view,
      'rasterflood_svg',
      'benchmarks',
      { detail: 'subtests' },
    );
    expect(subtestQueries[0]!.includeSubtests).toBe(true);
  });

  it('builds overview queries without subtest expansion', () => {
    const view = preset.config.views.win11!;
    const queries = buildBenchmarkQueries(
      preset.benchmarks,
      view,
      'overview',
      'network',
    );
    expect(queries.length).toBeGreaterThan(4);
    expect(queries.every((query) => query.includeSubtests === false)).toBe(
      true,
    );
  });

  it('deliberately overrides configured projects', () => {
    const view = preset.config.views.win11!;
    const [query] = buildBenchmarkQueries(
      preset.benchmarks,
      view,
      'rasterflood_svg',
      'benchmarks',
      { project: 'mozilla-central' },
    );
    expect(
      query!.series.every((series) => series.project === 'mozilla-central'),
    ).toBe(true);
  });

  it('does not expand a series onto platforms outside its applicability', () => {
    const view = preset.config.views.linux64!;
    const series = resolveSeries(
      {
        applicablePlatforms: ['linux1804-64-shippable-qr'],
        color: '#000',
        frameworkId: 13,
        label: 'Example',
        option: 'opt',
        suite: 'example',
      },
      view,
    );

    expect(series.map((entry) => entry.platform)).toEqual([
      'linux1804-64-shippable-qr',
    ]);
  });

  it('curates browser and framework applicability from live signatures', () => {
    const linux = preset.config.views.linux64!;
    const mac = preset.config.views.mac1500!;
    const windows = preset.config.views.win11!;

    const speedometer = buildBenchmarkQueries(
      preset.benchmarks,
      linux,
      'raptor-desktop-speedometer3',
      'benchmarks',
    )[0]!;
    expect(
      speedometer.series.filter((series) => series.application === 'safari'),
    ).toEqual([]);
    expect(
      speedometer.series.filter((series) => series.application === 'safari-tp'),
    ).toEqual([]);

    const macSpeedometer = buildBenchmarkQueries(
      preset.benchmarks,
      mac,
      'raptor-desktop-speedometer3',
      'benchmarks',
    )[0]!;
    expect(
      macSpeedometer.series
        .filter((series) => series.application === 'safari')
        .map((series) => series.platform),
    ).toEqual(['macosx1500-aarch64-shippable']);
    expect(
      macSpeedometer.series
        .filter((series) => series.application === 'safari-tp')
        .map((series) => series.platform),
    ).toEqual(['macosx1500-aarch64-shippable']);

    const jsbench = buildBenchmarkQueries(
      preset.benchmarks,
      linux,
      'ares6',
      'benchmarks',
    )[0]!;
    expect(
      jsbench.series
        .filter((series) => series.frameworkId === 11)
        .map((series) => series.platform),
    ).toEqual([]);
    expect(
      buildBenchmarkQueries(
        preset.benchmarks,
        preset.config.views.linux2404!,
        'ares6',
        'benchmarks',
      )[0]!
        .series.filter((series) => series.frameworkId === 11)
        .map((series) => series.platform),
    ).toEqual(['linux2404-64-shippable', 'linux2404-64-shippable']);

    const unityWindows = buildBenchmarkQueries(
      preset.benchmarks,
      windows,
      'raptor-desktop-unity-webgl',
      'benchmarks',
    )[0]!;
    expect(unityWindows.series).toMatchObject([
      {
        application: 'firefox',
        platform: 'windows11-64-24h2-shippable',
        project: 'mozilla-central',
      },
    ]);
    expect(unityWindows.series).toHaveLength(1);
    expect(preset.benchmarks.tabswitch).toBeUndefined();
  });
});
