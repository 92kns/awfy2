import { describe, expect, it } from 'vitest';
import {
  alertSummaryUrl,
  performanceDataUrls,
  treeherderPushUrl,
} from './urls';

describe('performance data URLs', () => {
  it('batches at 100 signatures and does not mutate input', () => {
    const ids = Array.from({ length: 205 }, (_, index) => 205 - index);
    const original = [...ids];
    const urls = performanceDataUrls(
      { frameworkId: 13, project: 'autoland' },
      ids,
      86400,
    );

    expect(urls).toHaveLength(3);
    expect(urls[0]!.searchParams.getAll('signature_id')).toHaveLength(100);
    expect(urls[1]!.searchParams.getAll('signature_id')).toHaveLength(100);
    expect(urls[2]!.searchParams.getAll('signature_id')).toHaveLength(5);
    expect(urls[0]!.searchParams.getAll('signature_id')[0]).toBe('1');
    expect(ids).toEqual(original);
  });
});

describe('Treeherder links and alert URLs', () => {
  it('builds an alert-summary request with its repository ID', () => {
    const url = alertSummaryUrl(42, 77, 86_400);

    expect(url.pathname).toBe('/api/performance/alertsummary/');
    expect(url.searchParams.get('alerts__series_signature')).toBe('42');
    expect(url.searchParams.get('repository')).toBe('77');
    expect(url.searchParams.get('limit')).toBe('100');
    expect(url.searchParams.get('timerange')).toBe('86400');
  });

  it('builds a revision-specific Treeherder push URL', () => {
    expect(treeherderPushUrl('autoland', 'abc123')).toBe(
      'https://treeherder.mozilla.org/jobs?repo=autoland&revision=abc123',
    );
  });
});
