import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResolvedSeries } from '../domain/types';
import { clearTreeherderCache, querySeries } from './client';
import { alertSummaryFixture } from './fixtures/alert-summary';

const series: ResolvedSeries = {
  application: 'firefox',
  color: '#f60',
  extraOptions: ['fission'],
  frameworkId: 13,
  label: 'Firefox',
  option: 'opt',
  platform: 'linux2404-64-shippable',
  project: 'autoland',
  suite: 'speedometer3',
};

const parent = {
  application: 'firefox',
  extra_options: ['fission'],
  framework_id: 13,
  has_subtests: true,
  id: 101,
  lower_is_better: false,
  machine_platform: 'linux2404-64-shippable',
  option_collection_hash: 'opt-hash',
  signature_hash: 'parent-hash',
  suite: 'speedometer3',
  test: 'speedometer3',
};

const repositories = [{ id: 77, name: 'autoland' }];

function performanceDatum(
  overrides: Partial<{
    id: number;
    job_id: number;
    push_id: number;
    push_timestamp: number;
    revision: string;
    value: number;
  }> = {},
) {
  return {
    id: 1,
    job_id: 10,
    push_id: 100,
    push_timestamp: 100,
    revision: 'abcdef',
    value: 9.5,
    ...overrides,
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

beforeEach(() => clearTreeherderCache());

afterEach(() => vi.unstubAllGlobals());

describe('Treeherder client', () => {
  it('validates, resolves, and fetches parent and subtest data', async () => {
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(input.toString());
      if (url.pathname === '/api/optioncollectionhash/') {
        return jsonResponse([
          {
            option_collection_hash: 'opt-hash',
            options: [{ name: 'opt' }],
          },
        ]);
      }
      if (url.pathname === '/api/repository/') {
        return jsonResponse(repositories);
      }
      if (url.pathname === '/api/performance/alertsummary/') {
        return jsonResponse({ results: [] });
      }
      if (url.searchParams.has('parent_signature')) {
        return jsonResponse({
          202: {
            ...parent,
            has_subtests: false,
            id: 202,
            signature_hash: 'subtest-hash',
            test: 'TodoMVC',
          },
        });
      }
      if (url.pathname.endsWith('/performance/signatures/')) {
        return jsonResponse({ 101: parent });
      }
      if (url.pathname.endsWith('/performance/data/')) {
        return jsonResponse({
          'parent-hash': [performanceDatum()],
          'subtest-hash': [
            performanceDatum({
              id: 2,
              job_id: 20,
              push_id: 101,
              push_timestamp: 101,
              revision: 'fedcba',
              value: 4.5,
            }),
          ],
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await querySeries(series, {
      includeSubtests: true,
      intervalSeconds: 86400,
      signal: new AbortController().signal,
    });

    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.graphs.map((graph) => graph.meta.test)).toEqual([
      'speedometer3',
      'TodoMVC',
    ]);
    expect(result.graphs[0]!.data[0]).toEqual({
      datumId: 1,
      jobId: 10,
      pushId: 100,
      pushUrl:
        'https://treeherder.mozilla.org/jobs?repo=autoland&revision=abcdef',
      revision: 'abcdef',
      timestamp: 100_000,
      value: 9.5,
    });
    expect(result.graphs.every((graph) => graph.alerts.length === 0)).toBe(
      true,
    );
    expect(fetchMock).toHaveBeenCalledTimes(7);
  });

  it('normalizes nullable parent fields used by the live API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: URL | RequestInfo) => {
        const url = new URL(input.toString());
        if (url.pathname === '/api/optioncollectionhash/') {
          return jsonResponse([
            {
              option_collection_hash: 'opt-hash',
              options: [{ name: 'opt' }],
            },
          ]);
        }
        if (url.pathname === '/api/repository/') {
          return jsonResponse(repositories);
        }
        if (url.pathname === '/api/performance/alertsummary/') {
          return jsonResponse({ results: [] });
        }
        if (url.pathname.endsWith('/performance/signatures/')) {
          return jsonResponse({
            101: { ...parent, has_subtests: null, test: null },
          });
        }
        return jsonResponse({
          'parent-hash': [performanceDatum()],
        });
      }),
    );

    const result = await querySeries(series, {
      includeSubtests: false,
      intervalSeconds: 86400,
      signal: new AbortController().signal,
    });
    expect(result.status).toBe('success');
  });

  it('validates and attaches matching alert-summary markers to a graph', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: URL | RequestInfo) => {
        const url = new URL(input.toString());
        if (url.pathname === '/api/optioncollectionhash/') {
          return jsonResponse([
            {
              option_collection_hash: 'opt-hash',
              options: [{ name: 'opt' }],
            },
          ]);
        }
        if (url.pathname === '/api/repository/') {
          return jsonResponse(repositories);
        }
        if (url.pathname === '/api/performance/alertsummary/') {
          return jsonResponse(alertSummaryFixture);
        }
        if (url.pathname.endsWith('/performance/signatures/')) {
          return jsonResponse({ 101: parent });
        }
        if (url.pathname.endsWith('/performance/data/')) {
          return jsonResponse({ 'parent-hash': [performanceDatum()] });
        }
        throw new Error(`Unexpected request: ${url}`);
      }),
    );

    const result = await querySeries(series, {
      includeSubtests: false,
      intervalSeconds: 86_400,
      signal: new AbortController().signal,
    });

    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.graphs[0]!.alerts).toEqual([
      {
        amountPct: 0.25,
        bugNumber: 123456,
        isRegression: true,
        newValue: 12.5,
        prevValue: 10,
        revision: 'alert-revision',
        seriesSignatureId: 101,
        status: 0,
        summaryId: 55,
        timestamp: 120_000,
      },
    ]);
  });

  it('returns a visible not-found result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: URL | RequestInfo) => {
        const url = new URL(input.toString());
        return url.pathname === '/api/optioncollectionhash/'
          ? jsonResponse([])
          : jsonResponse({});
      }),
    );

    const result = await querySeries(series, {
      includeSubtests: false,
      intervalSeconds: 86400,
      signal: new AbortController().signal,
    });
    expect(result).toMatchObject({ status: 'not-found', series });
  });

  it('distinguishes schema failures from network failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ broken: true })),
    );
    const invalid = await querySeries(series, {
      includeSubtests: false,
      intervalSeconds: 86400,
      signal: new AbortController().signal,
    });
    expect(invalid.status).toBe('invalid-response');

    clearTreeherderCache();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('offline');
      }),
    );
    const offline = await querySeries(series, {
      includeSubtests: false,
      intervalSeconds: 86400,
      signal: new AbortController().signal,
    });
    expect(offline.status).toBe('network-error');
  });

  it('does not share an abortable in-flight request with a newer route', async () => {
    const firstController = new AbortController();
    const secondController = new AbortController();
    let callCount = 0;
    const fetchMock = vi.fn(
      (input: URL | RequestInfo, init?: RequestInit): Promise<Response> => {
        callCount += 1;
        const url = new URL(input.toString());
        if (callCount <= 2) {
          return new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          });
        }
        if (url.pathname === '/api/optioncollectionhash/') {
          return Promise.resolve(
            jsonResponse([
              {
                option_collection_hash: 'opt-hash',
                options: [{ name: 'opt' }],
              },
            ]),
          );
        }
        if (url.pathname === '/api/repository/') {
          return Promise.resolve(jsonResponse(repositories));
        }
        if (url.pathname === '/api/performance/alertsummary/') {
          return Promise.resolve(jsonResponse({ results: [] }));
        }
        if (url.pathname.endsWith('/performance/signatures/')) {
          return Promise.resolve(jsonResponse({ 101: parent }));
        }
        return Promise.resolve(
          jsonResponse({
            'parent-hash': [performanceDatum()],
          }),
        );
      },
    );
    vi.stubGlobal('fetch', fetchMock);

    const first = querySeries(series, {
      includeSubtests: false,
      intervalSeconds: 86400,
      signal: firstController.signal,
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const second = querySeries(series, {
      includeSubtests: false,
      intervalSeconds: 86400,
      signal: secondController.signal,
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    firstController.abort();

    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await expect(second).resolves.toMatchObject({ status: 'success' });
  });
});
