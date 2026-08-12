import { describe, expect, it } from 'vitest';
import type { ResolvedSeries, Signature } from '../domain/types';
import { matchesSeries, resolveSignature } from './signatures';

const series: ResolvedSeries = {
  application: 'firefox',
  color: '#f60',
  extraOptions: ['fission', 'webrender'],
  frameworkId: 13,
  label: 'Firefox',
  option: 'opt',
  platform: 'linux2404-64-shippable',
  project: 'autoland',
  suite: 'speedometer3',
};

function signature(overrides: Partial<Signature> = {}): Signature {
  return {
    application: 'firefox',
    extraOptions: ['webrender', 'fission'],
    frameworkId: 13,
    hasSubtests: false,
    id: 10,
    optionCollectionHash: 'opt-hash',
    signatureHash: 'signature-hash',
    suite: 'speedometer3',
    test: 'speedometer3',
    ...overrides,
  };
}

const optionCollections = new Map([['opt-hash', new Set(['opt'])]]);

describe('signature resolution', () => {
  it('matches extra options without mutating either array', () => {
    const candidate = signature();
    const candidateOptions = [...candidate.extraOptions!];
    const configuredOptions = [...series.extraOptions!];

    expect(matchesSeries(candidate, series, optionCollections)).toBe(true);
    expect(candidate.extraOptions).toEqual(candidateOptions);
    expect(series.extraOptions).toEqual(configuredOptions);
  });

  it('distinguishes resolved, not-found, and ambiguous results', () => {
    expect(
      resolveSignature([signature()], series, optionCollections).status,
    ).toBe('resolved');
    expect(
      resolveSignature(
        [signature({ application: 'chrome' })],
        series,
        optionCollections,
      ).status,
    ).toBe('not-found');
    expect(
      resolveSignature(
        [signature(), signature({ id: 11, signatureHash: 'second' })],
        series,
        optionCollections,
      ).status,
    ).toBe('ambiguous');
  });

  it('requires the configured subtest when suite and test differ', () => {
    const subtestSeries = { ...series, test: 'SpeedIndex' };
    expect(
      matchesSeries(
        signature({ test: 'SpeedIndex' }),
        subtestSeries,
        optionCollections,
      ),
    ).toBe(true);
    expect(
      matchesSeries(
        signature({ test: 'FirstVisualChange' }),
        subtestSeries,
        optionCollections,
      ),
    ).toBe(false);
  });
});
