import { describe, expect, it } from 'vitest';
import preset from '../presets/awfy';
import { readSelection, selectionUrl } from './url-state';

describe('URL state', () => {
  it('round-trips a selection at the deployment root', () => {
    const current = new URL('https://example.test/awfy2/');
    const selection = {
      benchmark: 'speedometer3-android',
      category: 'benchmarks',
      days: 30,
      platform: 'androidGalaxyA55',
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
  });
});
