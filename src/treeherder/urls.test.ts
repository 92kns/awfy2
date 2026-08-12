import { describe, expect, it } from 'vitest';
import { performanceDataUrls } from './urls';

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
