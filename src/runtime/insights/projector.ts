import type { RuntimeCatalog } from "../catalog/types";
import type { Kind, TriageItem } from "../dataset/item";
import type { ScoreContext } from "../scoring/configured";
import { scoreAndTier } from "../scoring/configured";
import type { Tier } from "../scoring/tier";
import type {
  AgeSummary,
  Concentration,
  CoverageMetric,
  InsightSnapshot,
  TierCounts,
} from "./types";

export interface BuildInsightSnapshotInput {
  items: readonly TriageItem[];
  readyKinds: readonly Kind[];
  refreshedKinds: readonly Kind[];
  staleKinds?: readonly Kind[];
  catalog: RuntimeCatalog;
  score: ScoreContext;
  botLogins: readonly string[];
  now: number;
}

const TIERS: readonly Tier[] = ["P0", "P1", "P2", "P3"];
const PRIORITY_WEIGHT: Readonly<Record<Tier, number>> = {
  P0: 1_000,
  P1: 100,
  P2: 10,
  P3: 1,
};

const emptyTiers = (): Record<Tier, number> => ({
  P0: 0,
  P1: 0,
  P2: 0,
  P3: 0,
});

interface MutableConcentration {
  location: string;
  total: number;
  tiers: Record<Tier, number>;
  weightedPriority: number;
  kinds: Set<Kind>;
}

interface MutableMetric {
  supported: boolean;
  numerator: number;
  denominator: number;
}

const metric = (value: MutableMetric): CoverageMetric => {
  if (!value.supported) return Object.freeze({ status: "unavailable" });
  return Object.freeze({
    status: "available",
    numerator: value.numerator,
    denominator: value.denominator,
    ratio: value.denominator === 0 ? 0 : value.numerator / value.denominator,
  });
};

const immutableTiers = (tiers: Record<Tier, number>): TierCounts =>
  Object.freeze({ ...tiers });

const compareConcentration = (
  left: Readonly<MutableConcentration>,
  right: Readonly<MutableConcentration>,
): number => {
  for (const tier of TIERS) {
    const difference = right.tiers[tier] - left.tiers[tier];
    if (difference !== 0) return difference;
  }
  return right.total - left.total
    || left.location.localeCompare(right.location);
};

export function buildInsightSnapshot(
  input: BuildInsightSnapshotInput,
): InsightSnapshot {
  const ready = new Set(input.readyKinds);
  const totals = emptyTiers();
  const concentrations = new Map<string, MutableConcentration>();
  const age: AgeSummary = {
    under7Days: 0,
    from7To30Days: 0,
    from30To90Days: 0,
    over90Days: 0,
    staleHighPriority: 0,
    oldestDays: 0,
  };
  const actionability: MutableMetric = {
    supported: false,
    numerator: 0,
    denominator: 0,
  };
  const ownership: MutableMetric = {
    supported: false,
    numerator: 0,
    denominator: 0,
  };
  const evidence: MutableMetric = {
    supported: false,
    numerator: 0,
    denominator: 0,
  };
  let all = 0;
  let urgent = 0;
  let directlyActionable = 0;
  let actionableUrgentDenominator = 0;

  for (const item of input.items) {
    if (!ready.has(item.kind)) continue;
    const { score, tier } = scoreAndTier(item, input.score, input.catalog);
    void score;
    all += 1;
    totals[tier] += 1;

    const capabilities = input.catalog.insightsFor(item.kind);
    if (capabilities?.actionable) {
      actionability.supported = true;
      actionability.denominator += 1;
      actionability.numerator += Number(capabilities.actionable(item));
    }
    if (capabilities?.owned) {
      ownership.supported = true;
      ownership.denominator += 1;
      ownership.numerator += Number(capabilities.owned(item));
    }
    if (capabilities?.evidenced) {
      evidence.supported = true;
      evidence.denominator += 1;
      evidence.numerator += Number(capabilities.evidenced(item));
    }

    if (tier === "P0" || tier === "P1") {
      urgent += 1;
      if (capabilities?.actionable) {
        actionableUrgentDenominator += 1;
        directlyActionable += Number(capabilities.actionable(item));
      }
    }

    const concentration = concentrations.get(item.location) ?? {
      location: item.location,
      total: 0,
      tiers: emptyTiers(),
      weightedPriority: 0,
      kinds: new Set<Kind>(),
    };
    concentration.total += 1;
    concentration.tiers[tier] += 1;
    concentration.weightedPriority += PRIORITY_WEIGHT[tier];
    concentration.kinds.add(item.kind);
    concentrations.set(item.location, concentration);

    const createdAt = Date.parse(item.createdAt);
    const days = Number.isFinite(createdAt)
      ? Math.max(0, Math.floor((input.now - createdAt) / 86_400_000))
      : 0;
    age.oldestDays = Math.max(age.oldestDays, days);
    if (days < 7) age.under7Days += 1;
    else if (days < 30) age.from7To30Days += 1;
    else if (days <= 90) age.from30To90Days += 1;
    else age.over90Days += 1;
    if (days > 90 && (tier === "P0" || tier === "P1")) {
      age.staleHighPriority += 1;
    }
  }

  const concentrationRows: readonly Readonly<Concentration>[] = [
    ...concentrations.values(),
  ]
    .sort(compareConcentration)
    .map((entry) => Object.freeze({
      location: entry.location,
      total: entry.total,
      tiers: immutableTiers(entry.tiers),
      weightedPriority: entry.weightedPriority,
      kinds: Object.freeze([...entry.kinds].sort()),
    }));

  return Object.freeze({
    generatedAt: input.now,
    coverage: Object.freeze({
      readyKinds: Object.freeze([...input.readyKinds]),
      refreshedKinds: Object.freeze([...input.refreshedKinds]),
      staleKinds: Object.freeze([...(input.staleKinds ?? [])]),
    }),
    totals: Object.freeze({ all, ...totals }),
    attention: Object.freeze({
      urgent,
      directlyActionable,
      actionableUrgentDenominator,
    }),
    concentrations: Object.freeze(concentrationRows),
    age: Object.freeze({ ...age }),
    actionability: metric(actionability),
    ownership: metric(ownership),
    evidence: metric(evidence),
    diagnostics: Object.freeze([]),
  });
}
