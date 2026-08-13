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
    measurement_unit: z.string().nullish(),
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
    id: z.number(),
    is_regression: z.boolean(),
    new_value: z.number().nullish(),
    prev_value: z.number().nullish(),
    related_summary_id: z.number().nullish(),
    series_signature: z.object({ id: z.number() }).loose(),
    status: z.number(),
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
    count: z.number().nullish(),
    next: z.string().nullish(),
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
    ...(raw.measurement_unit ? { measurementUnit: raw.measurement_unit } : {}),
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

/**
 * Triage states from `treeherder/perf/models.py`.  Invalid and infra alerts
 * describe test or machine problems rather than product changes, so they must
 * not be drawn as regressions or improvements.
 */
export const ALERT_STATUS = {
  UNTRIAGED: 0,
  DOWNSTREAM: 1,
  REASSIGNED: 2,
  INVALID: 3,
  ACKNOWLEDGED: 4,
  INFRA: 5,
} as const;

export const ALERT_SUMMARY_STATUS = {
  UNTRIAGED: 0,
  DOWNSTREAM: 1,
  REASSIGNED: 2,
  INVALID: 3,
  IMPROVEMENT: 4,
  INVESTIGATING: 5,
  WONTFIX: 6,
  FIXED: 7,
  BACKED_OUT: 8,
  INFRA: 9,
} as const;

const HIDDEN_ALERT_STATUSES: readonly number[] = [
  ALERT_STATUS.INVALID,
  ALERT_STATUS.INFRA,
];

const HIDDEN_SUMMARY_STATUSES: readonly number[] = [
  ALERT_SUMMARY_STATUS.INVALID,
  ALERT_SUMMARY_STATUS.INFRA,
];

export function isReportableAlert(
  summary: Pick<z.infer<typeof rawAlertSummarySchema>, 'status'>,
  alert: Pick<z.infer<typeof rawAlertSchema>, 'status'>,
): boolean {
  return (
    !HIDDEN_SUMMARY_STATUSES.includes(summary.status) &&
    !HIDDEN_ALERT_STATUSES.includes(alert.status)
  );
}

export function normalizeAlertMarker(
  summary: z.infer<typeof rawAlertSummarySchema>,
  alert: z.infer<typeof rawAlertSchema>,
): PerformanceAlertMarker {
  return {
    alertId: alert.id,
    alertStatus: alert.status,
    ...(alert.amount_pct == null ? {} : { amountPct: alert.amount_pct }),
    ...(summary.bug_number == null ? {} : { bugNumber: summary.bug_number }),
    isRegression: alert.is_regression,
    ...(alert.new_value == null ? {} : { newValue: alert.new_value }),
    ...(alert.prev_value == null ? {} : { prevValue: alert.prev_value }),
    ...(alert.related_summary_id == null
      ? {}
      : { relatedSummaryId: alert.related_summary_id }),
    revision: summary.revision,
    seriesSignatureId: alert.series_signature.id,
    summaryId: summary.id,
    summaryStatus: summary.status,
    timestamp: summary.push_timestamp * 1000,
  };
}
