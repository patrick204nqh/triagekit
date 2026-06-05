import type { TriageItem } from "../dataset/item";
import { type DependencyVulnDetails, DEPENDENCY_VULN } from "../dataset/kinds/dependency-vuln";
import { registerScorer, type Scorer } from "./registry";

export function dependencyVulnScore(item: TriageItem<DependencyVulnDetails>): number {
  const d = item.details;
  const base = { critical: 100, high: 70, medium: 40, low: 10 }[d.severity] ?? 0;
  let score = base + d.cvss * 3;
  if (d.fixAvailable) score += 25;
  if (d.scope === "runtime") score += 15;
  else if (d.scope === "development") score -= 10;
  const ageDays = (Date.now() - +new Date(item.createdAt)) / 86400000;
  score += Math.min(ageDays / 7, 15);
  return Math.round(score);
}
registerScorer(DEPENDENCY_VULN, dependencyVulnScore as Scorer);
