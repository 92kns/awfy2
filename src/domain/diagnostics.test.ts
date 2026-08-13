import { describe, expect, it } from 'vitest';
import { GroupedDiagnostics } from './diagnostics';
import type { ResolvedSeries } from './types';

const series: ResolvedSeries = {
  color: '#f60',
  frameworkId: 13,
  label: 'Firefox',
  option: 'opt',
  platform: 'linux-old',
  suite: 'speedometer3',
};

describe('GroupedDiagnostics', () => {
  it('classifies and deduplicates logical platform aliases', () => {
    const diagnostics = GroupedDiagnostics.fromResults([
      {
        message: 'missing old platform',
        series,
        status: 'not-found',
      },
      {
        message: 'missing replacement platform',
        series: { ...series, platform: 'linux-new' },
        status: 'not-found',
      },
      {
        message: 'two signatures',
        series: { ...series, label: 'Chrome', platform: 'win' },
        status: 'ambiguous',
      },
      {
        message: 'bad JSON',
        series: { ...series, label: 'Safari', platform: 'mac' },
        status: 'invalid-response',
      },
      {
        message: 'offline',
        series: { ...series, label: 'Fenix', platform: 'android' },
        status: 'network-error',
      },
    ]);

    expect(diagnostics.unsupported).toHaveLength(1);
    expect(
      diagnostics.unsupported[0]!.aliases.map((alias) => alias.platform),
    ).toEqual(['linux-old', 'linux-new']);
    expect(diagnostics.ambiguous).toHaveLength(1);
    expect(diagnostics.invalidResponse).toHaveLength(1);
    expect(diagnostics.network).toHaveLength(1);
  });

  it('suppresses a retired alias when its logical replacement succeeds', () => {
    const diagnostics = GroupedDiagnostics.fromResults([
      { message: 'retired', series, status: 'not-found' },
      {
        series: { ...series, platform: 'linux-new' },
        status: 'success',
      },
    ]);

    expect(diagnostics.all).toEqual([]);
  });
});
