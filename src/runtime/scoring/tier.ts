export type Tier = "P0" | "P1" | "P2" | "P3";

export interface TierThresholds {
  p0: number;
  p1: number;
  p2: number;
}

export const DEFAULT_THRESHOLDS: TierThresholds = { p0: 130, p1: 95, p2: 60 };

export function tierOf(score: number, t: TierThresholds = DEFAULT_THRESHOLDS): Tier {
  if (score >= t.p0) return "P0";
  if (score >= t.p1) return "P1";
  if (score >= t.p2) return "P2";
  return "P3";
}
