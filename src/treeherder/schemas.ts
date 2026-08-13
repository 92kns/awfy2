import { z } from 'zod';
import type { Datum, PerformanceAlertMarker, Signature } from '../domain/types';
import { treeherderPushUrl } from './urls';

const rawSignatureSchema = z
  .object({
    application: z.string().nullish(),
    extra_options: z.array(z.string()).nullish(),
    framework_id: z.number(),
    has_subtests: z.boolean().nullish(),
    id: z.number(),
    lower_is_better: z.boolean().nullish(),
    machine_platform: z.string().nullish(),
    option_collection_hash: z.string(),
    signature_hash: z.string(),
    suite: z.string(),
    test: z.string().nullish(),
  })
  .loose();

export const signaturesResponseSchema = z.record(
  z.string(),
  rawSignatureSchema,
);

export const subtestsResponseSchema = z.record(z.string(), rawSignatureSchema);

export const optionCollectionsSchema = z.array(
  z
    .object({
      option_collection_hash: z.string(),
      options: z.array(z.object({ name: z.string() }).loose()),
    })
    .loose(),
);

const rawDatumSchema = z
  .object({
    id: z.number(),
    job_id: z.number(),
    push_id: z.number(),
    push_timestamp: z.number(),
    revision: z.string(),
    value: z.number(),
  })
  .loose();

export const performanceDataSchema = z.record(
  z.string(),
  z.array(rawDatumSchema),
);

const rawAlertSchema = z
  .object({
    amount_pct: z.number().nullish(),
    is_regression: z.boolean(),
    new_value: z.number().nullish(),
    prev_value: z.number().nullish(),
    series_signature: z.object({ id: z.number() }).loose(),
  })
  .loose();

const rawAlertSummarySchema = z
  .object({
    alerts: z.array(rawAlertSchema),
    bug_number: z.number().nullish(),
    id: z.number(),
    push_timestamp: z.number(),
    revision: z.string(),
    status: z.number(),
  })
  .loose();

export const alertSummaryResponseSchema = z
  .object({
    results: z.array(rawAlertSummarySchema),
  })
  .loose();

export const repositoriesResponseSchema = z.array(
  z
    .object({
      id: z.number(),
      name: z.string(),
    })
    .loose(),
);

export type RawSignature = z.infer<typeof rawSignatureSchema>;
export type OptionCollections = z.infer<typeof optionCollectionsSchema>;
export type AlertSummaryResponse = z.infer<typeof alertSummaryResponseSchema>;
export type RepositoriesResponse = z.infer<typeof repositoriesResponseSchema>;

export function normalizeSignature(raw: RawSignature): Signature {
  return {
    ...(raw.application ? { application: raw.application } : {}),
    ...(raw.extra_options ? { extraOptions: raw.extra_options } : {}),
    frameworkId: raw.framework_id,
    hasSubtests: raw.has_subtests ?? false,
    id: raw.id,
    ...(raw.lower_is_better == null
      ? {}
      : { lowerIsBetter: raw.lower_is_better }),
    ...(raw.machine_platform ? { machinePlatform: raw.machine_platform } : {}),
    optionCollectionHash: raw.option_collection_hash,
    signatureHash: raw.signature_hash,
    suite: raw.suite,
    test: raw.test ?? raw.suite,
  };
}

export function normalizeDatum(
  raw: z.infer<typeof rawDatumSchema>,
  project: string | undefined,
): Datum {
  return {
    datumId: raw.id,
    jobId: raw.job_id,
    pushId: raw.push_id,
    pushUrl: treeherderPushUrl(project, raw.revision),
    revision: raw.revision,
    timestamp: raw.push_timestamp * 1000,
    value: raw.value,
  };
}

export function normalizeAlertMarker(
  summary: z.infer<typeof rawAlertSummarySchema>,
  alert: z.infer<typeof rawAlertSchema>,
): PerformanceAlertMarker {
  return {
    ...(alert.amount_pct == null ? {} : { amountPct: alert.amount_pct }),
    ...(summary.bug_number == null ? {} : { bugNumber: summary.bug_number }),
    isRegression: alert.is_regression,
    ...(alert.new_value == null ? {} : { newValue: alert.new_value }),
    ...(alert.prev_value == null ? {} : { prevValue: alert.prev_value }),
    revision: summary.revision,
    seriesSignatureId: alert.series_signature.id,
    status: summary.status,
    summaryId: summary.id,
    timestamp: summary.push_timestamp * 1000,
  };
}
