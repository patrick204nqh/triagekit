import type { RuntimeCatalog } from "../../src/runtime/catalog/types";
import type { Kind, TriageItem } from "../../src/runtime/dataset/item";
import type { CoverageMetric } from "../../src/runtime/insights/types";
import type { ScoreContext } from "../../src/runtime/scoring/configured";

export function insightItem(
  over: Partial<TriageItem> & Pick<TriageItem, "id">,
): TriageItem {
  return {
    provider: "github",
    providerRef: {},
    kind: "issue",
    title: over.id,
    location: "acme-corp/web",
    signal: 20,
    createdAt: "2026-07-01T00:00:00Z",
    url: "",
    details: {},
    ...over,
  };
}

export function scoreContextFixture(catalog: RuntimeCatalog): ScoreContext {
  return {
    getModel: () => null,
    getFields: (kind: Kind) => catalog.fieldsFor(kind),
    getThresholds: () => ({ p0: 150, p1: 100, p2: 50 }),
  };
}

export const available = (
  numerator: number,
  denominator: number,
): CoverageMetric => ({
  status: "available",
  numerator,
  denominator,
  ratio: denominator === 0 ? 0 : numerator / denominator,
});

export const unavailable = (): CoverageMetric => ({ status: "unavailable" });
