import { describe, expect, it } from 'vitest';
import preset from '../presets/awfy';
import { buildBenchmarkQueries, validatePresetReferences } from './presets';

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
    expect(queries[0]!.includeSubtests).toBe(true);
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
});
