import { describe, expect, it } from 'vitest';
import {
  alertSummaryUrl,
  perfherderAlertUrl,
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
    const url = alertSummaryUrl('stylebench', 13, 77, 86_400);

    expect(url.pathname).toBe('/api/performance/alertsummary/');
    expect(url.searchParams.get('filter_text')).toBe('stylebench');
    expect(url.searchParams.get('framework')).toBe('13');
    expect(url.searchParams.get('repository')).toBe('77');
    expect(url.searchParams.get('limit')).toBe('100');
    expect(url.searchParams.get('timerange')).toBe('86400');
  });

  it('requests later alert pages explicitly', () => {
    expect(
      alertSummaryUrl('stylebench', 13, 77, 86_400).searchParams.has('page'),
    ).toBe(false);
    expect(
      alertSummaryUrl('stylebench', 13, 77, 86_400, 3).searchParams.get('page'),
    ).toBe('3');
  });

  it('links an alert summary to its Perfherder view', () => {
    expect(perfherderAlertUrl(52054)).toBe(
      'https://treeherder.mozilla.org/perfherder/alerts?id=52054',
    );
  });

  it('builds a revision-specific Treeherder push URL', () => {
    expect(treeherderPushUrl('autoland', 'abc123')).toBe(
      'https://treeherder.mozilla.org/jobs?repo=autoland&revision=abc123',
    );
  });
});
