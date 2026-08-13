import { describe, expect, it } from 'vitest';
import {
  auditSeriesKey,
  auditKeysFingerprint,
  compareToBaseline,
  EMPTY_AUDIT_BASELINE,
  formatAuditBaseline,
  parseAuditBaseline,
} from './audit';
import type { ResolvedSeries } from './types';

const firefox: ResolvedSeries = {
  application: 'firefox',
  color: '#f60',
  extraOptions: ['webrender', 'fission'],
  frameworkId: 13,
  label: 'Firefox',
  option: 'opt',
  platform: 'windows11-64-24h2-shippable',
  project: 'autoland',
  suite: 'speedometer3',
};

const chrome: ResolvedSeries = {
  ...firefox,
  application: 'chrome',
  extraOptions: [],
  label: 'Chrome',
  project: undefined,
};

function results(
  entries: readonly [ResolvedSeries, 'success' | 'not-found'][],
): { series: ResolvedSeries; status: 'success' | 'not-found' }[] {
  return entries.map(([series, status]) => ({ series, status }));
}

describe('live audit baseline', () => {
  it('keys a series independently of option ordering', () => {
    expect(auditSeriesKey(firefox)).toBe(
      'fw13 | autoland | windows11-64-24h2-shippable | speedometer3 | - | opt | fission+webrender | firefox',
    );
    expect(
      auditSeriesKey({ ...firefox, extraOptions: ['fission', 'webrender'] }),
    ).toBe(auditSeriesKey(firefox));
    expect(auditSeriesKey(chrome)).toContain('| default |');
  });

  it('round-trips keys whose optional fields are all absent', () => {
    // A talos series has no application and, for some tests, a padded name.
    const talos: ResolvedSeries = {
      color: '#f60',
      frameworkId: 1,
      label: 'Firefox',
      option: 'opt',
      platform: 'linux1804-64-shippable-qr',
      suite: 'glvideo',
      test: 'Mean tick time across 100 ticks: ',
    };
    const keys = [auditSeriesKey(talos), auditSeriesKey(firefox)];
    const unresolved: string[] = [];
    const baseline = parseAuditBaseline(formatAuditBaseline(keys, unresolved));

    expect(baseline.notFoundTotal).toBe(0);
    expect(baseline.notFoundFingerprint).toBe(auditKeysFingerprint(unresolved));
    expect([...baseline.resolved].sort()).toEqual([...keys].sort());
    expect(
      compareToBaseline(
        results([
          [talos, 'success'],
          [firefox, 'success'],
        ]),
        baseline,
      ),
    ).toMatchObject({ added: [], failing: false, regressed: [] });
  });

  it('fails when a recorded series stops resolving', () => {
    const baseline = parseAuditBaseline(
      formatAuditBaseline(
        [auditSeriesKey(firefox), auditSeriesKey(chrome)],
        [],
      ),
    );
    const comparison = compareToBaseline(
      results([
        [firefox, 'success'],
        [chrome, 'not-found'],
      ]),
      baseline,
    );

    expect(comparison.regressed).toEqual([auditSeriesKey(chrome)]);
    expect(comparison.failing).toBe(true);
  });

  it('fails when a preset change adds configurations that do not exist', () => {
    const baseline = parseAuditBaseline(
      formatAuditBaseline([auditSeriesKey(firefox)], []),
    );
    const comparison = compareToBaseline(
      results([
        [firefox, 'success'],
        [chrome, 'not-found'],
      ]),
      baseline,
    );

    expect(comparison.regressed).toEqual([]);
    expect(comparison.grewBy).toBe(1);
    expect(comparison.failing).toBe(true);
  });

  it('requires review when unresolved debt changes even if it shrinks', () => {
    const baseline = parseAuditBaseline(
      formatAuditBaseline([auditSeriesKey(firefox)], [auditSeriesKey(chrome)]),
    );
    const comparison = compareToBaseline(
      results([
        [firefox, 'success'],
        [chrome, 'success'],
      ]),
      baseline,
    );

    expect(comparison.added).toEqual([auditSeriesKey(chrome)]);
    expect(comparison.grewBy).toBe(0);
    expect(comparison.notFoundChanged).toBe(true);
    expect(comparison.failing).toBe(true);
  });

  it('detects a changed unresolved set even when its count stays flat', () => {
    const baseline = parseAuditBaseline(
      formatAuditBaseline([auditSeriesKey(firefox)], [auditSeriesKey(chrome)]),
    );
    const replacement = { ...chrome, suite: 'jetstream3' };
    const comparison = compareToBaseline(
      results([
        [firefox, 'success'],
        [replacement, 'not-found'],
      ]),
      baseline,
    );

    expect(comparison.grewBy).toBe(0);
    expect(comparison.notFoundChanged).toBe(true);
    expect(comparison.failing).toBe(true);
  });

  it('still fails for ambiguity even with an intact baseline', () => {
    const baseline = parseAuditBaseline(
      formatAuditBaseline([auditSeriesKey(firefox)], []),
    );
    expect(
      compareToBaseline(results([[firefox, 'success']]), baseline, true)
        .failing,
    ).toBe(true);
  });

  it('does not fail a first run that has no baseline', () => {
    const comparison = compareToBaseline(
      results([
        [firefox, 'success'],
        [chrome, 'not-found'],
      ]),
      EMPTY_AUDIT_BASELINE,
    );

    expect(comparison.regressed).toEqual([]);
    expect(comparison.grewBy).toBe(0);
    expect(comparison.failing).toBe(false);
    expect(comparison.notFoundTotal).toBe(1);
  });
});
