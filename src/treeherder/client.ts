import { z } from 'zod';
import type {
  PerformanceGraph,
  ResolvedSeries,
  SeriesQueryResult,
  Signature,
} from '../domain/types';
import {
  normalizeDatum,
  normalizeSignature,
  optionCollectionsSchema,
  performanceDataSchema,
  signaturesResponseSchema,
  subtestsResponseSchema,
} from './schemas';
import { indexOptionCollections, resolveSignature } from './signatures';
import {
  optionCollectionsUrl,
  perfherderGraphUrl,
  performanceDataUrls,
  platformSignaturesUrl,
  subtestsUrl,
} from './urls';

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  expiresAt: number;
  value: unknown;
}

const responseCache = new Map<string, CacheEntry>();

export class InvalidResponseError extends Error {
  constructor(
    readonly url: string,
    readonly cause: unknown,
  ) {
    super(`Treeherder returned an unexpected response for ${url}`);
    this.name = 'InvalidResponseError';
  }
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

  // Cache only completed responses. An in-flight fetch is owned by its caller's
  // AbortSignal and must not be shared with a newer route that has a different
  // lifetime.
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Treeherder request failed: ${response.status}`);
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
  return parsed.data;
}

async function fetchPerformanceGraphs(
  series: ResolvedSeries,
  signatures: readonly Signature[],
  intervalSeconds: number,
  signal: AbortSignal,
): Promise<PerformanceGraph[]> {
  const responses = await Promise.all(
    performanceDataUrls(
      series,
      signatures.map((signature) => signature.id),
      intervalSeconds,
    ).map((url) => fetchJson(url, performanceDataSchema, signal)),
  );
  const byHash = Object.assign({}, ...responses);

  return signatures.map((signature) => ({
    data: (byHash[signature.signatureHash] ?? []).map(normalizeDatum),
    meta: signature,
    perfherderUrl: perfherderGraphUrl(series, [signature.id], intervalSeconds),
  }));
}

export async function querySeries(
  series: ResolvedSeries,
  options: {
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

    return {
      graphs: await fetchPerformanceGraphs(
        series,
        requestedSignatures,
        options.intervalSeconds,
        options.signal,
      ),
      series,
      status: 'success',
    };
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError')
      throw error;
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
}
