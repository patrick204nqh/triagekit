import type { RuntimeCatalog } from "../../src/runtime/catalog/types";
import type { Kind, TriageItem } from "../../src/runtime/dataset/item";
import type {
  CoverageMetric,
  InsightSnapshot,
} from "../../src/runtime/insights/types";
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

export function snapshotFixture(
  over: Partial<InsightSnapshot> = {},
): InsightSnapshot {
  return {
    generatedAt: Date.parse("2026-07-28T00:00:00Z"),
    coverage: {
      readyKinds: [
        "dependency-vuln",
        "code-scanning",
        "change-request",
        "issue",
      ],
      refreshedKinds: [
        "dependency-vuln",
        "code-scanning",
        "change-request",
        "issue",
      ],
      staleKinds: [],
    },
    totals: { all: 12, P0: 5, P1: 3, P2: 2, P3: 2 },
    attention: {
      urgent: 8,
      directlyActionable: 6,
      actionableUrgentDenominator: 8,
    },
    concentrations: [],
    age: {
      under7Days: 3,
      from7To30Days: 4,
      from30To90Days: 3,
      over90Days: 2,
      staleHighPriority: 1,
      oldestDays: 120,
    },
    actionability: available(8, 12),
    ownership: available(7, 10),
    evidence: available(11, 12),
    diagnostics: [],
    ...over,
  };
}
