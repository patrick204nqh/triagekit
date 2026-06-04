import type { Alert } from "../../providers/registry";

export function defaultPriorityScore(a: Alert): number {
  const base = { critical: 100, high: 70, medium: 40, low: 10 }[a.severity] ?? 0;
  let score = base + a.cvss * 3;
  if (a.fixAvailable) score += 25;
  if (a.scope === "runtime") score += 15;
  else if (a.scope === "development") score -= 10;
  const ageDays = (Date.now() - +new Date(a.createdAt)) / 86400000;
  score += Math.min(ageDays / 7, 15);
  return Math.round(score);
}

export function tierOf(score: number): "P0" | "P1" | "P2" | "P3" {
  if (score >= 130) return "P0";
  if (score >= 95) return "P1";
  if (score >= 60) return "P2";
  return "P3";
}
