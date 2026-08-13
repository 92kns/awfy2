import { describe, expect, it } from 'vitest';
import preset from '../presets/awfy';
import { readSelection, selectionUrl } from './url-state';

describe('URL state', () => {
  it('round-trips a selection at the deployment root', () => {
    const current = new URL('https://example.test/awfy2/');
    const selection = {
      benchmark: 'speedometer3-android',
      category: 'benchmarks',
      chart: 'median' as const,
      days: 30,
      detail: 'subtests' as const,
      platform: 'androidGalaxyA55',
      baseline: 'Fenix',
      project: 'mozilla-central' as const,
      subtestSearch: 'score',
      values: 'relative' as const,
      visibleSeries: ['Fenix'],
    };
    const url = selectionUrl(selection, current);
    expect(url.pathname).toBe('/awfy2/');
    expect(readSelection(preset, url)).toEqual(selection);
  });

  it('falls back from invalid external state', () => {
    const selection = readSelection(
      preset,
      new URL(
        'https://example.test/?platform=nope&category=nope&benchmark=nope&days=999',
      ),
    );
    expect(selection.platform).toBe(preset.config.default.platform);
    expect(selection.category).toBe(preset.config.default.category);
    expect(selection.benchmark).toBe('overview');
    expect(selection.days).toBe(preset.config.default.dayRange);
    expect(selection.detail).toBe('summary');
    expect(selection.project).toBe('configured');
    expect(selection.chart).toBe('scatter');
    expect(selection.values).toBe('absolute');
    expect(selection.baseline).toBeNull();
  });

  it('uses validated defaults for new URL state and accepts legacy URLs', () => {
    const selection = readSelection(
      preset,
      new URL(
        'https://example.test/?platform=androidGalaxyA55&category=benchmarks&benchmark=speedometer3-android&days=30&detail=nope&project=bad&chart=nope&values=nope&baseline=Nope',
      ),
    );
    expect(selection).toMatchObject({
      benchmark: 'speedometer3-android',
      detail: 'summary',
      project: 'configured',
      chart: 'scatter',
      values: 'absolute',
      baseline: null,
      subtestSearch: '',
      visibleSeries: null,
    });
  });
});
