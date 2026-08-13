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
        expect(url.searchParams.get('filter_text')).toBe('speedometer3');
        expect(url.searchParams.get('framework')).toBe('13');
        expect(url.searchParams.has('alerts__series_signature')).toBe(false);
        return jsonResponse({
          next: null,
          results: [
            {
              alerts: [
                {
                  amount_pct: 5,
                  id: 900,
                  is_regression: true,
                  new_value: 4.5,
                  prev_value: 4,
                  related_summary_id: null,
                  series_signature: { id: 202 },
                  status: 0,
                },
              ],
              bug_number: null,
              id: 800,
              push_timestamp: 101,
              revision: 'fedcba',
              status: 0,
            },
          ],
        });
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
    expect(result.graphs[0]!.alerts).toEqual([]);
    expect(result.graphs[1]!.alerts).toMatchObject([
      { alertId: 900, seriesSignatureId: 202, summaryId: 800 },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(6);
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
        alertId: 246261,
        alertStatus: 0,
        amountPct: 8.94,
        bugNumber: 123456,
        isRegression: true,
        newValue: 12.5,
        prevValue: 10,
        revision: 'alert-revision',
        seriesSignatureId: 101,
        summaryId: 55,
        summaryStatus: 0,
        timestamp: 120_000,
      },
    ]);
  });

  it('keeps valid performance data when alert enrichment fails', async () => {
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
          return jsonResponse({ broken: true });
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
    expect(result.graphs[0]!.data).toHaveLength(1);
    expect(result.graphs[0]!.alerts).toEqual([]);
    // Degrading silently would present an unannotated graph as fully annotated.
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings![0]).toContain(
      'Regression and improvement markers are unavailable',
    );
  });

  it('batches the performance data of every series in one route', async () => {
    const chromeSignature = {
      ...parent,
      application: 'chrome',
      extra_options: [],
      has_subtests: false,
      id: 303,
      signature_hash: 'chrome-hash',
    };
    const dataUrls: URL[] = [];
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(input.toString());
      if (url.pathname === '/api/optioncollectionhash/') {
        return jsonResponse([
          { option_collection_hash: 'opt-hash', options: [{ name: 'opt' }] },
        ]);
      }
      if (url.pathname === '/api/repository/')
        return jsonResponse(repositories);
      if (url.pathname === '/api/performance/alertsummary/') {
        return jsonResponse({ next: null, results: [] });
      }
      if (url.pathname.endsWith('/performance/signatures/')) {
        return jsonResponse({ 101: parent, 303: chromeSignature });
      }
      if (url.pathname.endsWith('/performance/data/')) {
        dataUrls.push(url);
        return jsonResponse({
          'chrome-hash': [performanceDatum({ id: 3, value: 8.5 })],
          'parent-hash': [performanceDatum()],
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const signal = new AbortController().signal;

    const [firefox, chrome] = await Promise.all([
      querySeries(series, {
        includeAlerts: false,
        includeSubtests: false,
        intervalSeconds: 86_400,
        signal,
      }),
      querySeries(
        { ...series, application: 'chrome', extraOptions: [], label: 'Chrome' },
        {
          includeAlerts: false,
          includeSubtests: false,
          intervalSeconds: 86_400,
          signal,
        },
      ),
    ]);

    expect(firefox.status).toBe('success');
    expect(chrome.status).toBe('success');
    expect(dataUrls).toHaveLength(1);
    expect(dataUrls[0]!.searchParams.getAll('signature_id')).toEqual([
      '101',
      '303',
    ]);
  });

  it('isolates malformed data in one series from its batch siblings', async () => {
    const chromeSignature = {
      ...parent,
      application: 'chrome',
      extra_options: [],
      has_subtests: false,
      id: 303,
      signature_hash: 'chrome-hash',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: URL | RequestInfo) => {
        const url = new URL(input.toString());
        if (url.pathname === '/api/optioncollectionhash/') {
          return jsonResponse([
            { option_collection_hash: 'opt-hash', options: [{ name: 'opt' }] },
          ]);
        }
        if (url.pathname.endsWith('/performance/signatures/')) {
          return jsonResponse({ 101: parent, 303: chromeSignature });
        }
        if (url.pathname.endsWith('/performance/data/')) {
          return jsonResponse({
            'chrome-hash': [performanceDatum({ id: 3, value: 8.5 })],
            'parent-hash': [
              performanceDatum({ value: 'not-a-number' as never }),
            ],
          });
        }
        throw new Error(`Unexpected request: ${url}`);
      }),
    );
    const signal = new AbortController().signal;

    const [firefox, chrome] = await Promise.all([
      querySeries(series, {
        includeAlerts: false,
        includeSubtests: false,
        intervalSeconds: 86_400,
        signal,
      }),
      querySeries(
        { ...series, application: 'chrome', extraOptions: [], label: 'Chrome' },
        {
          includeAlerts: false,
          includeSubtests: false,
          intervalSeconds: 86_400,
          signal,
        },
      ),
    ]);

    expect(firefox.status).toBe('invalid-response');
    expect(chrome.status).toBe('success');
    if (chrome.status === 'success') {
      expect(chrome.graphs[0]!.data[0]!.value).toBe(8.5);
    }
  });

  it('splits a rejected batch to recover unaffected series', async () => {
    const chromeSignature = {
      ...parent,
      application: 'chrome',
      extra_options: [],
      has_subtests: false,
      id: 303,
      signature_hash: 'chrome-hash',
    };
    const dataRequests: string[][] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: URL | RequestInfo) => {
        const url = new URL(input.toString());
        if (url.pathname === '/api/optioncollectionhash/') {
          return jsonResponse([
            { option_collection_hash: 'opt-hash', options: [{ name: 'opt' }] },
          ]);
        }
        if (url.pathname.endsWith('/performance/signatures/')) {
          return jsonResponse({ 101: parent, 303: chromeSignature });
        }
        if (url.pathname.endsWith('/performance/data/')) {
          const ids = url.searchParams.getAll('signature_id');
          dataRequests.push(ids);
          if (ids.length > 1 || ids[0] === '101') return jsonResponse({}, 400);
          return jsonResponse({
            'chrome-hash': [performanceDatum({ id: 3, value: 8.5 })],
          });
        }
        throw new Error(`Unexpected request: ${url}`);
      }),
    );
    const signal = new AbortController().signal;

    const [firefox, chrome] = await Promise.all([
      querySeries(series, {
        includeAlerts: false,
        includeSubtests: false,
        intervalSeconds: 86_400,
        signal,
      }),
      querySeries(
        { ...series, application: 'chrome', extraOptions: [], label: 'Chrome' },
        {
          includeAlerts: false,
          includeSubtests: false,
          intervalSeconds: 86_400,
          signal,
        },
      ),
    ]);

    expect(dataRequests).toEqual([['101', '303'], ['101'], ['303']]);
    expect(firefox.status).toBe('network-error');
    expect(chrome.status).toBe('success');
  });

  it('keeps performance data when the repository catalogue fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: URL | RequestInfo) => {
        const url = new URL(input.toString());
        if (url.pathname === '/api/optioncollectionhash/') {
          return jsonResponse([
            { option_collection_hash: 'opt-hash', options: [{ name: 'opt' }] },
          ]);
        }
        if (url.pathname === '/api/repository/') {
          return jsonResponse({ detail: 'unavailable' }, 503);
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
    expect(result.graphs[0]!.data).toHaveLength(1);
    expect(result.graphs[0]!.alerts).toEqual([]);
    expect(result.warnings![0]).toContain('Treeherder request failed: 503');
  });

  it('pages through alert summaries and hides invalid and infra alerts', async () => {
    const alertPages: string[] = [];
    const summary = (id: number, alerts: unknown[], status = 0) => ({
      alerts,
      bug_number: null,
      id,
      push_timestamp: 120,
      revision: `revision-${id}`,
      status,
    });
    const alert = (id: number, status: number) => ({
      amount_pct: 5,
      id,
      is_regression: true,
      new_value: 12,
      prev_value: 10,
      related_summary_id: null,
      series_signature: { id: 101 },
      status,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: URL | RequestInfo) => {
        const url = new URL(input.toString());
        if (url.pathname === '/api/optioncollectionhash/') {
          return jsonResponse([
            { option_collection_hash: 'opt-hash', options: [{ name: 'opt' }] },
          ]);
        }
        if (url.pathname === '/api/repository/')
          return jsonResponse(repositories);
        if (url.pathname === '/api/performance/alertsummary/') {
          const page = url.searchParams.get('page') ?? '1';
          alertPages.push(page);
          return page === '1'
            ? jsonResponse({
                count: 4,
                next: 'https://treeherder.mozilla.org/api/performance/alertsummary/?page=2',
                results: [
                  summary(1, [alert(11, 0), alert(12, 3)]),
                  // An invalid summary hides even an untriaged alert.
                  summary(2, [alert(13, 0)], 3),
                ],
              })
            : jsonResponse({
                count: 4,
                next: null,
                results: [
                  summary(3, [alert(14, 4), alert(15, 5)]),
                  // Repeated across pages while triage moves rows around.
                  summary(1, [alert(11, 0)]),
                ],
              });
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

    expect(alertPages).toEqual(['1', '2']);
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.graphs[0]!.alerts.map((marker) => marker.alertId)).toEqual([
      11, 14,
    ]);
    // Both pages were consumed, so nothing was truncated.
    expect(result.warnings).toBeUndefined();
  });

  it('warns instead of paging forever when alerts never run out', async () => {
    const alertPages: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: URL | RequestInfo) => {
        const url = new URL(input.toString());
        if (url.pathname === '/api/optioncollectionhash/') {
          return jsonResponse([
            { option_collection_hash: 'opt-hash', options: [{ name: 'opt' }] },
          ]);
        }
        if (url.pathname === '/api/repository/')
          return jsonResponse(repositories);
        if (url.pathname === '/api/performance/alertsummary/') {
          const page = url.searchParams.get('page') ?? '1';
          alertPages.push(page);
          // A pathological signature: every page claims another one follows.
          return jsonResponse({
            count: 10_000,
            next: `https://treeherder.mozilla.org/api/performance/alertsummary/?page=${
              Number(page) + 1
            }`,
            results: [
              {
                alerts: [
                  {
                    amount_pct: 5,
                    id: Number(page),
                    is_regression: true,
                    new_value: 12,
                    prev_value: 10,
                    related_summary_id: null,
                    series_signature: { id: 101 },
                    status: 0,
                  },
                ],
                bug_number: null,
                id: Number(page),
                push_timestamp: 120,
                revision: `revision-${page}`,
                status: 0,
              },
            ],
          });
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

    expect(alertPages).toEqual(['1', '2', '3', '4', '5']);
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.graphs[0]!.alerts).toHaveLength(5);
    expect(result.warnings![0]).toContain('most recent alerts are shown');
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
    // The second route re-requests the catalogues it must not inherit, and may
    // already have continued into batched data and alert requests.
    await vi.waitFor(() =>
      expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(4),
    );
    firstController.abort();

    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await expect(second).resolves.toMatchObject({ status: 'success' });
  });

  it('removes queued requests immediately when a route is aborted', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(
      (_input: URL | RequestInfo, init?: RequestInit): Promise<Response> =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          );
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const requests = Array.from({ length: 8 }, (_, index) =>
      querySeries(
        { ...series, platform: `platform-${index}` },
        {
          includeAlerts: false,
          includeSubtests: false,
          intervalSeconds: 86_400,
          signal: controller.signal,
        },
      ),
    );
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(6));
    controller.abort();

    const settled = await Promise.allSettled(requests);
    expect(settled).toHaveLength(8);
    expect(
      settled.every(
        (result) =>
          result.status === 'rejected' && result.reason?.name === 'AbortError',
      ),
    ).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('deduplicates common in-flight requests within one route', async () => {
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
      if (url.pathname.endsWith('/performance/signatures/')) {
        return jsonResponse({ 101: parent });
      }
      if (url.pathname.endsWith('/performance/data/')) {
        return jsonResponse({ 'parent-hash': [performanceDatum()] });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const signal = new AbortController().signal;

    const results = await Promise.all([
      querySeries(series, {
        includeSubtests: false,
        intervalSeconds: 86_400,
        signal,
      }),
      querySeries(series, {
        includeSubtests: false,
        intervalSeconds: 86_400,
        signal,
      }),
    ]);

    expect(results).toMatchObject([
      { status: 'success' },
      { status: 'success' },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});
