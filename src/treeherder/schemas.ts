import { z } from 'zod';
import type { Datum, Signature } from '../domain/types';

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
    push_timestamp: z.number(),
    value: z.number(),
  })
  .loose();

export const performanceDataSchema = z.record(
  z.string(),
  z.array(rawDatumSchema),
);

export type RawSignature = z.infer<typeof rawSignatureSchema>;
export type OptionCollections = z.infer<typeof optionCollectionsSchema>;

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

export function normalizeDatum(raw: z.infer<typeof rawDatumSchema>): Datum {
  return {
    datumId: raw.id,
    timestamp: raw.push_timestamp * 1000,
    value: raw.value,
  };
}
