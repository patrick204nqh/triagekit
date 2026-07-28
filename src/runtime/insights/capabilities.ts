import type { TriageItem } from "../dataset/item";
import type { CoverageMetric } from "./types";

export function capabilityMetric(
  items: readonly TriageItem[],
  reader: ((item: TriageItem) => boolean) | undefined,
): CoverageMetric {
  if (!reader) return Object.freeze({ status: "unavailable" });
  const numerator = items.reduce(
    (count, item) => count + Number(reader(item)),
    0,
  );
  const denominator = items.length;
  return Object.freeze({
    status: "available",
    numerator,
    denominator,
    ratio: denominator === 0 ? 0 : numerator / denominator,
  });
}
