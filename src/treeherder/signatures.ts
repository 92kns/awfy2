import type {
  ResolvedSeries,
  Signature,
  SignatureResolution,
} from '../domain/types';
import type { OptionCollections } from './schemas';

export function indexOptionCollections(
  collections: OptionCollections,
): Map<string, Set<string>> {
  return new Map(
    collections.map((collection) => [
      collection.option_collection_hash,
      new Set(collection.options.map((option) => option.name)),
    ]),
  );
}

function equalStringSets(left?: readonly string[], right?: readonly string[]) {
  if (!left && !right) return true;
  if (!left || !right || left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}

export function matchesSeries(
  signature: Signature,
  series: ResolvedSeries,
  optionsByHash: ReadonlyMap<string, ReadonlySet<string>>,
): boolean {
  const options = optionsByHash.get(signature.optionCollectionHash);
  const suiteAndTestMatch =
    signature.suite === series.suite &&
    ((signature.suite !== signature.test && signature.test === series.test) ||
      signature.suite === signature.test);

  return (
    suiteAndTestMatch &&
    options?.has(series.option) === true &&
    (!series.application || signature.application === series.application) &&
    equalStringSets(signature.extraOptions, series.extraOptions)
  );
}

export function resolveSignature(
  signatures: readonly Signature[],
  series: ResolvedSeries,
  optionsByHash: ReadonlyMap<string, ReadonlySet<string>>,
): SignatureResolution {
  const suiteCandidates = signatures.filter(
    (signature) => signature.suite === series.suite,
  );
  const candidates = suiteCandidates.filter((signature) =>
    matchesSeries(signature, series, optionsByHash),
  );

  if (candidates.length === 1) {
    return { status: 'resolved', signature: candidates[0]! };
  }
  if (candidates.length === 0) {
    return { status: 'not-found', candidates: suiteCandidates };
  }
  return { status: 'ambiguous', candidates };
}
