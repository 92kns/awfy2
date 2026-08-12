import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResolvedSeries } from '../domain/types';
import { clearTreeherderCache, querySeries } from './client';

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
          'parent-hash': [{ id: 1, push_timestamp: 100, value: 9.5 }],
          'subtest-hash': [{ id: 2, push_timestamp: 101, value: 4.5 }],
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
      timestamp: 100_000,
      value: 9.5,
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
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
        if (url.pathname.endsWith('/performance/signatures/')) {
          return jsonResponse({
            101: { ...parent, has_subtests: null, test: null },
          });
        }
        return jsonResponse({
          'parent-hash': [{ id: 1, push_timestamp: 100, value: 9.5 }],
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
        if (url.pathname.endsWith('/performance/signatures/')) {
          return Promise.resolve(jsonResponse({ 101: parent }));
        }
        return Promise.resolve(
          jsonResponse({
            'parent-hash': [{ id: 1, push_timestamp: 100, value: 9.5 }],
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
