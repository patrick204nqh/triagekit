import type { Tier } from "../scoring/tier";
import type {
  CoverageMetric,
  EffectivenessDiagnostic,
} from "./types";

export const MIN_DISTINCT_SCORE_RATIO = 0.6;
export const MAX_TOP_TIER_RATIO = 0.35;
export const MIN_COVERAGE_RATIO = 0.7;
export const MAX_DUPLICATE_RATIO = 0.2;

export interface DiagnosticInput {
  scores: readonly number[];
  tiers: readonly Tier[];
  actionability: CoverageMetric;
  ownership: CoverageMetric;
  evidence: CoverageMetric;
  duplicateCount: number;
  mutedBotCount: number;
}

const diagnostic = (
  value: EffectivenessDiagnostic,
): Readonly<EffectivenessDiagnostic> => Object.freeze(value);

function coverageDiagnostic(
  id:
    | "actionability-coverage"
    | "ownership-coverage"
    | "evidence-coverage",
  title: string,
  metric: CoverageMetric,
  actionId?: "filters",
): Readonly<EffectivenessDiagnostic> {
  if (metric.status === "unavailable") {
    return diagnostic({
      id,
      severity: "limited",
      title,
      explanation: `${title} is unavailable for the current item kinds.`,
    });
  }
  const healthy = metric.ratio >= MIN_COVERAGE_RATIO;
  return diagnostic({
    id,
    severity: healthy ? "healthy" : "attention",
    title,
    explanation: healthy
      ? `${metric.numerator} of ${metric.denominator} items are covered.`
      : `Only ${metric.numerator} of ${metric.denominator} items are covered.`,
    numerator: metric.numerator,
    denominator: metric.denominator,
    ...(!healthy && actionId ? { actionId } : {}),
  });
}

export function diagnoseEffectiveness(
  input: DiagnosticInput,
): readonly Readonly<EffectivenessDiagnostic>[] {
  const total = input.scores.length;
  const distinctScores = new Set(input.scores).size;
  const scoreRatio = total === 0 ? 0 : distinctScores / total;
  const p0Count = input.tiers.filter((tier) => tier === "P0").length;
  const topTierRatio = input.tiers.length === 0
    ? 0
    : p0Count / input.tiers.length;
  const noiseCount = input.duplicateCount + input.mutedBotCount;
  const noiseRatio = total === 0 ? 0 : noiseCount / total;

  return Object.freeze([
    diagnostic({
      id: "score-separation",
      severity: total === 0
        ? "limited"
        : scoreRatio >= MIN_DISTINCT_SCORE_RATIO
          ? "healthy"
          : "attention",
      title: "Score separation",
      explanation: total === 0
        ? "Score separation is unavailable without scored items."
        : `${distinctScores} distinct scores rank ${total} items.`,
      ...(total > 0
        ? {
            numerator: distinctScores,
            denominator: total,
            ...(scoreRatio < MIN_DISTINCT_SCORE_RATIO
              ? { actionId: "scoring" as const }
              : {}),
          }
        : {}),
    }),
    diagnostic({
      id: "priority-concentration",
      severity: input.tiers.length === 0
        ? "limited"
        : topTierRatio > MAX_TOP_TIER_RATIO
          ? "attention"
          : "healthy",
      title: "Priority concentration",
      explanation: input.tiers.length === 0
        ? "Priority concentration is unavailable without scored items."
        : `${p0Count} of ${input.tiers.length} items are P0.`,
      ...(input.tiers.length > 0
        ? {
            numerator: p0Count,
            denominator: input.tiers.length,
            ...(topTierRatio > MAX_TOP_TIER_RATIO
              ? { actionId: "scoring" as const }
              : {}),
          }
        : {}),
    }),
    coverageDiagnostic(
      "actionability-coverage",
      "Actionability coverage",
      input.actionability,
      "filters",
    ),
    coverageDiagnostic(
      "ownership-coverage",
      "Ownership coverage",
      input.ownership,
    ),
    coverageDiagnostic(
      "evidence-coverage",
      "Evidence coverage",
      input.evidence,
    ),
    diagnostic({
      id: "noise-pressure",
      severity: total === 0
        ? "limited"
        : noiseRatio > MAX_DUPLICATE_RATIO
          ? "attention"
          : "healthy",
      title: "Noise pressure",
      explanation: total === 0
        ? "Noise pressure is unavailable without scored items."
        : `${noiseCount} of ${total} items are duplicated or automation-muted.`,
      ...(total > 0
        ? {
            numerator: noiseCount,
            denominator: total,
            ...(noiseRatio > MAX_DUPLICATE_RATIO
              ? { actionId: "filters" as const }
              : {}),
          }
        : {}),
    }),
  ]);
}
