import type { DatasetSnapshot } from "../cached-dataset/types";
import type { TriageFailure } from "../catalog/types";
import type { Kind } from "../dataset/item";

export function providerFailures(
  snapshot: DatasetSnapshot | undefined,
): readonly TriageFailure[] {
  return snapshot?.slices.flatMap((slice) =>
    slice.failure ? [slice.failure] : []) ?? [];
}

export function failuresForKinds(
  snapshot: DatasetSnapshot | undefined,
  kinds: readonly Kind[],
): readonly TriageFailure[] {
  const active = new Set(kinds);
  return snapshot?.slices.flatMap((slice) =>
    active.has(slice.kind) && slice.failure ? [slice.failure] : []) ?? [];
}
