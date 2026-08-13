import type { ResolvedSeries, SeriesQueryResult } from './types';

/**
 * Live-audit bookkeeping.
 *
 * The curated presets inherit thousands of browser/platform combinations that
 * Treeherder has never had, so the count of unresolved series says nothing
 * about whether the dashboard just broke. The audit therefore records the set
 * that *does* resolve plus a compact fingerprint of the exact unresolved set.
 * A series disappearing from the resolving set or any unreviewed change to the
 * not-found debt is therefore actionable, even when two changes cancel out in
 * the aggregate count.
 */
export const NOT_FOUND_TOTAL_PREFIX = '# not-found-total:';
export const NOT_FOUND_FINGERPRINT_PREFIX = '# not-found-fingerprint:';

export interface AuditBaseline {
  notFoundFingerprint: string | null;
  notFoundTotal: number;
  resolved: ReadonlySet<string>;
}

export interface AuditComparison {
  /** Series that resolve now but were not in the baseline. */
  added: string[];
  failing: boolean;
  /** How much the not-found total grew; zero when it shrank or held. */
  grewBy: number;
  /** The exact unresolved set changed, even if its total stayed constant. */
  notFoundChanged: boolean;
  notFoundFingerprint: string;
  notFoundKeys: string[];
  notFoundTotal: number;
  /** Baseline series that no longer resolve. */
  regressed: string[];
  resolvedKeys: string[];
}

type AuditResult = Pick<SeriesQueryResult, 'status'> & {
  series: ResolvedSeries;
};

/** Absent fields are written explicitly so no key ends in trailing space. */
const ABSENT = '-';

export function auditSeriesKey(
  series: Pick<
    ResolvedSeries,
    | 'application'
    | 'extraOptions'
    | 'frameworkId'
    | 'option'
    | 'platform'
    | 'project'
    | 'suite'
    | 'test'
  >,
): string {
  return [
    `fw${series.frameworkId}`,
    series.project ?? 'default',
    series.platform,
    series.suite,
    series.test?.trim() || ABSENT,
    series.option,
    [...(series.extraOptions ?? [])].sort().join('+') || ABSENT,
    series.application ?? ABSENT,
  ].join(' | ');
}

export function parseAuditBaseline(text: string): AuditBaseline {
  const lines = text.split('\n').map((line) => line.trim());
  const countLine = lines.find((line) =>
    line.startsWith(NOT_FOUND_TOTAL_PREFIX),
  );
  const parsed = countLine
    ? Number(countLine.slice(NOT_FOUND_TOTAL_PREFIX.length).trim())
    : Number.NaN;
  const fingerprintLine = lines.find((line) =>
    line.startsWith(NOT_FOUND_FINGERPRINT_PREFIX),
  );
  return {
    notFoundFingerprint:
      fingerprintLine?.slice(NOT_FOUND_FINGERPRINT_PREFIX.length).trim() ||
      null,
    // An absent or unreadable total must not fail every later run.
    notFoundTotal: Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY,
    resolved: new Set(lines.filter((line) => line && !line.startsWith('#'))),
  };
}

export function formatAuditBaseline(
  resolvedKeys: readonly string[],
  notFoundKeys: readonly string[],
): string {
  const notFoundFingerprint = auditKeysFingerprint(notFoundKeys);
  return `${[
    '# Treeherder configured series that resolve to exactly one signature.',
    '# Regenerate with `npm run audit:live -- --update-baseline`.',
    '# fw<framework> | project | platform | suite | test | option | extraOptions | application',
    `${NOT_FOUND_TOTAL_PREFIX} ${notFoundKeys.length}`,
    `${NOT_FOUND_FINGERPRINT_PREFIX} ${notFoundFingerprint}`,
    ...[...resolvedKeys].sort(),
  ].join('\n')}\n`;
}

export const EMPTY_AUDIT_BASELINE: AuditBaseline = {
  notFoundFingerprint: null,
  notFoundTotal: Number.POSITIVE_INFINITY,
  resolved: new Set(),
};

/** Two stable 32-bit hashes over sorted keys; compact but sensitive to debt changes. */
export function auditKeysFingerprint(keys: readonly string[]): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  const input = [...keys].sort().join('\n');
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return [first, second]
    .map((value) => (value >>> 0).toString(16).padStart(8, '0'))
    .join('');
}

export function compareToBaseline(
  results: readonly AuditResult[],
  baseline: AuditBaseline,
  hasActionableProblems = false,
): AuditComparison {
  const resolvedKeys = results
    .filter((result) => result.status === 'success')
    .map((result) => auditSeriesKey(result.series))
    .sort();
  const resolved = new Set(resolvedKeys);
  const notFoundKeys = results
    .filter((result) => result.status === 'not-found')
    .map((result) => auditSeriesKey(result.series))
    .sort();
  const notFoundTotal = notFoundKeys.length;
  const notFoundFingerprint = auditKeysFingerprint(notFoundKeys);
  const regressed = [...baseline.resolved]
    .filter((key) => !resolved.has(key))
    .sort();
  const added = resolvedKeys.filter((key) => !baseline.resolved.has(key));
  const grewBy = Number.isFinite(baseline.notFoundTotal)
    ? Math.max(0, notFoundTotal - baseline.notFoundTotal)
    : 0;
  const notFoundChanged =
    baseline.notFoundFingerprint != null
      ? baseline.notFoundFingerprint !== notFoundFingerprint
      : grewBy > 0;

  return {
    added,
    failing: hasActionableProblems || regressed.length > 0 || notFoundChanged,
    grewBy,
    notFoundChanged,
    notFoundFingerprint,
    notFoundKeys,
    notFoundTotal,
    regressed,
    resolvedKeys,
  };
}
