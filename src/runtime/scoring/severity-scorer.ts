// src/runtime/scoring/severity-scorer.ts
import type { TriageItem } from "../dataset/item";

export const SEVERITY_BASE: Record<string, number> = { critical: 100, high: 70, medium: 40, low: 10 };

function ageBonus(createdAt: string): number {
  return Math.min((Date.now() - +new Date(createdAt)) / 86400000 / 7, 15);
}

export function makeSeverityScorer<D>(cfg: {
  severity: (d: D) => string;
  adjust?: (d: D) => number;
  clampZero?: boolean;
}): (item: TriageItem<D>) => number {
  return (item) => {
    const d = item.details;
    let score = (SEVERITY_BASE[cfg.severity(d)] ?? 0) + (cfg.adjust?.(d) ?? 0) + ageBonus(item.createdAt);
    if (cfg.clampZero) score = Math.max(0, score);
    return Math.round(score);
  };
}
