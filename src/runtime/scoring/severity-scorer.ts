// src/runtime/scoring/severity-scorer.ts
import type { TriageItem } from "../dataset/item";
import type { BuiltInScoreFactor, ScoreExplanation } from "./score-model";

export const SEVERITY_BASE: Record<string, number> = { critical: 100, high: 70, medium: 40, low: 10 };

interface FactorConfig<D> {
  readonly label: string;
  readonly raw: (details: D) => BuiltInScoreFactor["raw"];
  readonly contribution: (details: D) => number;
  readonly reason: (details: D) => string;
}

interface SeverityConfig<D> {
  severity: (d: D) => string;
  adjust?: (d: D) => number;
  factors?: readonly FactorConfig<D>[];
  clampZero?: boolean;
}

export interface SeverityScoring<D> {
  readonly score: (item: TriageItem<D>, now?: number) => number;
  readonly explain: (
    item: TriageItem<D>,
    now: number,
  ) => Extract<ScoreExplanation, { source: "built-in" }>;
}

export function makeSeverityScoring<D>(cfg: SeverityConfig<D>): SeverityScoring<D> {
  const calculate = (item: TriageItem<D>, now: number) => {
    const d = item.details;
    const severity = cfg.severity(d);
    const factors: BuiltInScoreFactor[] = [{
      label: "Severity",
      raw: severity,
      contribution: SEVERITY_BASE[severity] ?? 0,
      reason: `${severity} severity`,
    }, ...(cfg.factors ?? []).map((factor) => ({
      label: factor.label,
      raw: factor.raw(d),
      contribution: factor.contribution(d),
      reason: factor.reason(d),
    }))];
    if (!cfg.factors && cfg.adjust) {
      factors.push({
        label: "Adjustment",
        raw: cfg.adjust(d),
        contribution: cfg.adjust(d),
        reason: "kind adjustment",
      });
    }
    const subtotal = factors.reduce((total, factor) => total + factor.contribution, 0);
    const ageDays = (now - +new Date(item.createdAt)) / 86400000;
    const unrounded = subtotal + Math.min(ageDays / 7, 15);
    const score = Math.round(cfg.clampZero ? Math.max(0, unrounded) : unrounded);
    factors.push({
      label: "Age",
      raw: Math.round(ageDays),
      contribution: score - subtotal,
      reason: `${Math.round(ageDays)} days open`,
    });
    return { score, factors };
  };

  return {
    score: (item, now = Date.now()) => calculate(item, now).score,
    explain: (item, now) => ({
      source: "built-in",
      ...calculate(item, now),
    }),
  };
}

export function makeSeverityScorer<D>(cfg: SeverityConfig<D>): SeverityScoring<D>["score"] {
  return makeSeverityScoring(cfg).score;
}
