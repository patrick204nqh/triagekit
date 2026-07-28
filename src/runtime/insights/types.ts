import type { Kind, TriageItem } from "../dataset/item";
import type { Tier } from "../scoring/tier";

export interface InsightCapabilities {
  actionable?(item: TriageItem): boolean;
  owned?(item: TriageItem): boolean;
  evidenced?(item: TriageItem): boolean;
  dedupeKey?(item: TriageItem): string | undefined;
}

export type CoverageMetric =
  | Readonly<{
      status: "available";
      numerator: number;
      denominator: number;
      ratio: number;
    }>
  | Readonly<{ status: "unavailable" }>;

export interface InsightCoverage {
  readyKinds: readonly Kind[];
  refreshedKinds: readonly Kind[];
  staleKinds: readonly Kind[];
}

export type TierCounts = Readonly<Record<Tier, number>>;

export interface AttentionSummary {
  urgent: number;
  directlyActionable: number;
  actionableUrgentDenominator: number;
}

export interface Concentration {
  location: string;
  total: number;
  tiers: TierCounts;
  weightedPriority: number;
  kinds: readonly Kind[];
}

export interface AgeSummary {
  under7Days: number;
  from7To30Days: number;
  from30To90Days: number;
  over90Days: number;
  staleHighPriority: number;
  oldestDays: number;
}

export interface EffectivenessDiagnostic {
  id:
    | "score-separation"
    | "priority-concentration"
    | "actionability-coverage"
    | "ownership-coverage"
    | "evidence-coverage"
    | "noise-pressure";
  severity: "healthy" | "attention" | "limited";
  title: string;
  explanation: string;
  numerator?: number;
  denominator?: number;
  actionId?: "scoring" | "filters";
}

export interface InsightSnapshot {
  generatedAt: number;
  coverage: Readonly<InsightCoverage>;
  totals: Readonly<{ all: number } & TierCounts>;
  attention: Readonly<AttentionSummary>;
  concentrations: readonly Readonly<Concentration>[];
  age: Readonly<AgeSummary>;
  actionability: CoverageMetric;
  ownership: CoverageMetric;
  evidence: CoverageMetric;
  diagnostics: readonly Readonly<EffectivenessDiagnostic>[];
}
