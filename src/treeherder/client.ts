import { z } from 'zod';
import type {
  PerformanceGraph,
  PerformanceAlertMarker,
  ResolvedSeries,
  SeriesQueryResult,
  Signature,
} from '../domain/types';
import {
  alertSummaryResponseSchema,
  type AlertSummaryResponse,
  isReportableAlert,
  normalizeDatum,
  normalizeAlertMarker,
  normalizeSignature,
  optionCollectionsSchema,
  performanceDataSchema,
  repositoriesResponseSchema,
  signaturesResponseSchema,
  subtestsResponseSchema,
} from './schemas';
import { indexOptionCollections, resolveSignature } from './signatures';
import {
  ALERT_SUMMARY_PAGE_SIZE,
  alertSummaryUrl,
  optionCollectionsUrl,
  perfherderGraphUrl,
  performanceDataUrls,
  platformSignaturesUrl,
  repositoriesUrl,
  subtestsUrl,
} from './urls';

const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Treeherder is a shared production service, so a dashboard view must not open
 * an unbounded number of sockets. Six in-flight requests keep an overview
 * responsive without behaving like a load test.
 */
const MAX_IN_FLIGHT_REQUESTS = 6;

/** Alert pages are 100 summaries each; five pages bound a pathological series. */
const MAX_ALERT_SUMMARY_PAGES = 5;

const CACHE_SWEEP_THRESHOLD = 200;

interface CacheEntry {
  expiresAt: number;
  value: unknown;
}

type PerformanceData = z.infer<typeof performanceDataSchema>;
const performanceDataEnvelopeSchema = z.record(z.string(), z.unknown());
type PerformanceDataEnvelope = z.infer<typeof performanceDataEnvelopeSchema>;

/**
 * Alerts are an enrichment, so a failure degrades the graph instead of failing
 * it. Carrying the reason alongside the markers is what keeps that degradation
 * visible rather than silent.
 */
interface AlertMarkerResult {
  markers: Map<number, PerformanceAlertMarker[]>;
  warnings: string[];
}

interface PerformanceDataBatch {
  ids: Set<number>;
  scheduled: boolean;
  waiters: {
    reject: (reason: unknown) => void;
    resolve: (value: PerformanceData) => void;
    signatures: readonly Pick<Signature, 'id' | 'signatureHash'>[];
  }[];
}

const responseCache = new Map<string, CacheEntry>();
let inFlightBySignal = new WeakMap<
  AbortSignal,
  Map<string, Promise<unknown>>
>();
let batchesBySignal = new WeakMap<
  AbortSignal,
  Map<string, PerformanceDataBatch>
>();

let activeRequests = 0;
let requestQueue: (() => void)[] = [];

export class InvalidResponseError extends Error {
  constructor(
    readonly url: string,
    readonly cause: unknown,
  ) {
    super(`Treeherder returned an unexpected response for ${url}`);
    this.name = 'InvalidResponseError';
  }
}

class TreeherderRequestError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
  ) {
    super(`Treeherder request failed: ${status}`);
    this.name = 'TreeherderRequestError';
  }
}

/**
 * `fetch` rejects with a `DOMException` in browsers but with a plain error in
 * some Node builds, so aborts are recognised by name rather than by class.
 */
export function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

/**
 * A long-lived tab visits many routes, and every subtest view adds cache keys.
 * Sweeping expired entries once the map is large keeps that bounded without
 * paying for a sweep on every request.
 */
function evictExpiredResponses(): void {
  if (responseCache.size <= CACHE_SWEEP_THRESHOLD) return;
  const now = Date.now();
  for (const [key, entry] of responseCache) {
    if (entry.expiresAt <= now) responseCache.delete(key);
  }
}

function acquireRequestSlot(signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  if (activeRequests < MAX_IN_FLIGHT_REQUESTS) {
    activeRequests += 1;
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    let waiting = true;
    const grant = () => {
      waiting = false;
      signal.removeEventListener('abort', abort);
      activeRequests += 1;
      resolve();
    };
    const abort = () => {
      if (!waiting) return;
      waiting = false;
      const index = requestQueue.indexOf(grant);
      if (index >= 0) requestQueue.splice(index, 1);
      reject(signal.reason);
    };
    requestQueue.push(grant);
    signal.addEventListener('abort', abort, { once: true });
    // Close the small race between the initial check and listener install.
    if (signal.aborted) abort();
  });
}

function releaseRequestSlot(): void {
  activeRequests -= 1;
  requestQueue.shift()?.();
}

async function fetchJson<T>(
  url: URL,
  schema: z.ZodType<T>,
  signal: AbortSignal,
): Promise<T> {
  const key = url.toString();
  const cached = responseCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  // Requests in one route share an AbortSignal, so they can safely deduplicate
  // common signature and option-catalogue fetches. A newer route has a distinct
  // signal and therefore never inherits an older route's abort lifetime.
  let inFlight = inFlightBySignal.get(signal);
  if (!inFlight) {
    inFlight = new Map();
    inFlightBySignal.set(signal, inFlight);
  }
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const request = (async (): Promise<T> => {
    await acquireRequestSlot(signal);
    let response: Response;
    try {
      response = await fetch(url, { signal });
    } finally {
      releaseRequestSlot();
    }
    if (!response.ok) {
      throw new TreeherderRequestError(key, response.status);
    }
    const json: unknown = await response.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new InvalidResponseError(key, parsed.error);
    }

    responseCache.set(key, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      value: parsed.data,
    });
    evictExpiredResponses();
    return parsed.data;
  })();
  inFlight.set(key, request);

  try {
    return await request;
  } finally {
    if (inFlight.get(key) === request) inFlight.delete(key);
  }
}

interface PerformanceDataChunkResult {
  data: PerformanceDataEnvelope;
  errors: Map<number, unknown>;
}

/**
 * A bad signature can make Treeherder reject a combined request. Split only
 * client-error batches until that signature is isolated; retrying server and
 * network failures would amplify an outage without recovering useful data.
 */
async function fetchPerformanceDataChunk(
  series: Pick<ResolvedSeries, 'frameworkId' | 'project'>,
  signatureIds: readonly number[],
  intervalSeconds: number,
  signal: AbortSignal,
): Promise<PerformanceDataChunkResult> {
  const [url] = performanceDataUrls(series, signatureIds, intervalSeconds);
  if (!url) return { data: {}, errors: new Map() };

  try {
    return {
      data: await fetchJson(url, performanceDataEnvelopeSchema, signal),
      errors: new Map(),
    };
  } catch (error) {
    if (isAbortError(error)) throw error;

    if (
      signatureIds.length > 1 &&
      error instanceof TreeherderRequestError &&
      error.status >= 400 &&
      error.status < 500
    ) {
      const midpoint = Math.ceil(signatureIds.length / 2);
      const [left, right] = await Promise.all([
        fetchPerformanceDataChunk(
          series,
          signatureIds.slice(0, midpoint),
          intervalSeconds,
          signal,
        ),
        fetchPerformanceDataChunk(
          series,
          signatureIds.slice(midpoint),
          intervalSeconds,
          signal,
        ),
      ]);
      return {
        data: { ...left.data, ...right.data },
        errors: new Map([...left.errors, ...right.errors]),
      };
    }

    return {
      data: {},
      errors: new Map(signatureIds.map((id) => [id, error])),
    };
  }
}

function performanceDataBatchKey(
  series: Pick<ResolvedSeries, 'frameworkId' | 'project'>,
  intervalSeconds: number,
): string {
  return JSON.stringify([
    series.project ?? '',
    series.frameworkId,
    intervalSeconds,
  ]);
}

function flushPerformanceDataBatch(
  batch: PerformanceDataBatch,
  batches: Map<string, PerformanceDataBatch>,
  key: string,
  series: Pick<ResolvedSeries, 'frameworkId' | 'project'>,
  intervalSeconds: number,
  signal: AbortSignal,
): void {
  if (batches.get(key) === batch) batches.delete(key);
  const waiters = batch.waiters;
  const sortedIds = [...batch.ids].sort((a, b) => a - b);
  const chunks: number[][] = [];
  for (let offset = 0; offset < sortedIds.length; offset += 100) {
    chunks.push(sortedIds.slice(offset, offset + 100));
  }

  void Promise.all(
    chunks.map((ids) =>
      fetchPerformanceDataChunk(series, ids, intervalSeconds, signal),
    ),
  ).then(
    (results) => {
      const data: PerformanceDataEnvelope = Object.assign(
        {},
        ...results.map((result) => result.data),
      );
      const errors = new Map(results.flatMap((result) => [...result.errors]));

      for (const waiter of waiters) {
        const failedId = waiter.signatures.find(({ id }) => errors.has(id));
        if (failedId) {
          waiter.reject(errors.get(failedId.id));
          continue;
        }

        // Validate only the hashes this caller requested. A malformed sibling
        // in the shared response must not erase otherwise healthy graphs.
        const requestedData = Object.fromEntries(
          waiter.signatures.map(({ signatureHash }) => [
            signatureHash,
            data[signatureHash] ?? [],
          ]),
        );
        const parsed = performanceDataSchema.safeParse(requestedData);
        if (!parsed.success) {
          const validationUrl = performanceDataUrls(
            series,
            waiter.signatures.map(({ id }) => id),
            intervalSeconds,
          )[0];
          waiter.reject(
            new InvalidResponseError(
              validationUrl?.toString() ?? key,
              parsed.error,
            ),
          );
          continue;
        }
        waiter.resolve(parsed.data);
      }
    },
    (error: unknown) => {
      for (const waiter of waiters) waiter.reject(error);
    },
  );
}

/**
 * Collects the signature ids requested by every series that shares a project,
 * framework, and interval, then fetches them in batches of 100.
 *
 * An overview resolves all of its series from one shared signature response, so
 * the requests arrive in the same task and a single macrotask hop is enough to
 * turn hundreds of one-signature requests into a handful of batched ones.
 */
function fetchPerformanceData(
  series: Pick<ResolvedSeries, 'frameworkId' | 'project'>,
  signatures: readonly Pick<Signature, 'id' | 'signatureHash'>[],
  intervalSeconds: number,
  signal: AbortSignal,
): Promise<PerformanceData> {
  const existing = batchesBySignal.get(signal);
  const batches = existing ?? new Map<string, PerformanceDataBatch>();
  if (!existing) batchesBySignal.set(signal, batches);

  const key = performanceDataBatchKey(series, intervalSeconds);
  const pending: PerformanceDataBatch = batches.get(key) ?? {
    ids: new Set(),
    scheduled: false,
    waiters: [],
  };
  batches.set(key, pending);
  for (const { id } of signatures) pending.ids.add(id);

  const result = new Promise<PerformanceData>((resolve, reject) => {
    pending.waiters.push({ reject, resolve, signatures });
  });
  if (!pending.scheduled) {
    pending.scheduled = true;
    setTimeout(() => {
      flushPerformanceDataBatch(
        pending,
        batches,
        key,
        series,
        intervalSeconds,
        signal,
      );
    }, 0);
  }
  return result;
}

async function fetchPerformanceGraphs(
  series: ResolvedSeries,
  signatures: readonly Signature[],
  intervalSeconds: number,
  includeAlerts: boolean,
  signal: AbortSignal,
): Promise<{ graphs: PerformanceGraph[]; warnings: string[] }> {
  const [byHash, alerts] = await Promise.all([
    fetchPerformanceData(series, signatures, intervalSeconds, signal),
    includeAlerts
      ? fetchAlertMarkers(series, signatures, intervalSeconds, signal)
      : Promise.resolve<AlertMarkerResult>({
          markers: new Map(),
          warnings: [],
        }),
  ]);

  return {
    graphs: signatures.map((signature) => ({
      alerts: alerts.markers.get(signature.id) ?? [],
      data: (byHash[signature.signatureHash] ?? []).map((datum) =>
        normalizeDatum(datum, series.project),
      ),
      meta: signature,
      perfherderUrl: perfherderGraphUrl(
        series,
        [signature.id],
        intervalSeconds,
      ),
    })),
    warnings: alerts.warnings,
  };
}

async function fetchRepositoryId(
  project: string | undefined,
  signal: AbortSignal,
): Promise<number> {
  const repository = (
    await fetchJson(repositoriesUrl(), repositoriesResponseSchema, signal)
  ).find((candidate) => candidate.name === (project ?? 'mozilla-central'));

  if (!repository) {
    throw new Error(
      `Treeherder did not return a repository for ${project ?? 'mozilla-central'}.`,
    );
  }

  return repository.id;
}

/**
 * Alert annotations enrich graphs but must never make performance data fail,
 * including when the repository catalogue itself cannot be loaded.
 */
async function fetchAlertMarkers(
  series: ResolvedSeries,
  signatures: readonly Signature[],
  intervalSeconds: number,
  signal: AbortSignal,
): Promise<AlertMarkerResult> {
  try {
    const repositoryId = await fetchRepositoryId(series.project, signal);
    return await fetchAlerts(signatures, repositoryId, intervalSeconds, signal);
  } catch (error: unknown) {
    if (isAbortError(error)) throw error;
    // Keyed by cause, not by series: the repository catalogue and the alert
    // endpoint are shared, so every series in a view fails together and one
    // banner entry per cause is the honest count.
    return {
      markers: new Map(),
      warnings: [
        `Regression and improvement markers are unavailable: ${
          error instanceof Error ? error.message : 'unknown Treeherder error'
        }`,
      ],
    };
  }
}

async function fetchAlerts(
  signatures: readonly Signature[],
  repositoryId: number,
  intervalSeconds: number,
  signal: AbortSignal,
): Promise<AlertMarkerResult> {
  const parent = signatures[0];
  if (!parent) return { markers: new Map(), warnings: [] };
  const warnings: string[] = [];
  const requestedIds = new Set(signatures.map((signature) => signature.id));

  // Search summaries by suite and framework. An exact parent-signature filter
  // misses summaries that contain only child alerts (for example StyleBench),
  // while one query per child would turn a large subtest view into hundreds of
  // requests. Responses are filtered back to the requested signature ids.
  // Summaries are paginated at 100 by Treeherder regardless of the limit.
  const summaries: AlertSummaryResponse['results'] = [];
  for (let page = 1; page <= MAX_ALERT_SUMMARY_PAGES; page += 1) {
    const response = await fetchJson(
      alertSummaryUrl(
        parent.suite,
        parent.frameworkId,
        repositoryId,
        intervalSeconds,
        page,
      ),
      alertSummaryResponseSchema,
      signal,
    );
    summaries.push(...response.results);
    if (!response.next || response.results.length === 0) break;
    if (page === MAX_ALERT_SUMMARY_PAGES) {
      warnings.push(
        `Only the ${MAX_ALERT_SUMMARY_PAGES * ALERT_SUMMARY_PAGE_SIZE} most recent alerts are shown for ${parent.suite}; older markers in this range are omitted.`,
      );
    }
  }

  const bySignature = new Map<number, PerformanceAlertMarker[]>();
  const seenAlertIds = new Set<number>();
  for (const summary of summaries) {
    for (const alert of summary.alerts) {
      if (!requestedIds.has(alert.series_signature.id)) continue;
      if (!isReportableAlert(summary, alert)) continue;
      if (seenAlertIds.has(alert.id)) continue;
      seenAlertIds.add(alert.id);
      const markers = bySignature.get(alert.series_signature.id);
      const marker = normalizeAlertMarker(summary, alert);
      if (markers) {
        markers.push(marker);
      } else {
        bySignature.set(alert.series_signature.id, [marker]);
      }
    }
  }
  return { markers: bySignature, warnings };
}

export async function querySeries(
  series: ResolvedSeries,
  options: {
    includeAlerts?: boolean;
    includeSubtests: boolean;
    intervalSeconds: number;
    signal: AbortSignal;
  },
): Promise<SeriesQueryResult> {
  try {
    const [rawSignatures, rawOptions] = await Promise.all([
      fetchJson(
        platformSignaturesUrl(series),
        signaturesResponseSchema,
        options.signal,
      ),
      fetchJson(
        optionCollectionsUrl(),
        optionCollectionsSchema,
        options.signal,
      ),
    ]);
    const signatures = Object.values(rawSignatures).map(normalizeSignature);
    const resolution = resolveSignature(
      signatures,
      series,
      indexOptionCollections(rawOptions),
    );

    if (resolution.status !== 'resolved') {
      return {
        candidates: resolution.candidates,
        message:
          resolution.status === 'not-found'
            ? 'No Treeherder signature matches this configured series.'
            : `Expected one signature but found ${resolution.candidates.length}.`,
        series,
        status: resolution.status,
      };
    }

    let requestedSignatures = [resolution.signature];
    if (options.includeSubtests && resolution.signature.hasSubtests) {
      const rawSubtests = await fetchJson(
        subtestsUrl(series.project, resolution.signature.signatureHash),
        subtestsResponseSchema,
        options.signal,
      );
      requestedSignatures = [
        resolution.signature,
        ...Object.values(rawSubtests).map(normalizeSignature),
      ];
    }

    const { graphs, warnings } = await fetchPerformanceGraphs(
      series,
      requestedSignatures,
      options.intervalSeconds,
      options.includeAlerts !== false,
      options.signal,
    );

    return {
      graphs,
      series,
      status: 'success',
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  } catch (error: unknown) {
    if (isAbortError(error)) throw error;
    return {
      message:
        error instanceof Error ? error.message : 'Unknown Treeherder error',
      series,
      status:
        error instanceof InvalidResponseError
          ? 'invalid-response'
          : 'network-error',
    };
  }
}

export function clearTreeherderCache(): void {
  responseCache.clear();
  inFlightBySignal = new WeakMap();
  batchesBySignal = new WeakMap();
  activeRequests = 0;
  requestQueue = [];
}
