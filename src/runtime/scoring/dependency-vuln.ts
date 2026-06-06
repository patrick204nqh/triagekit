import type { TriageItem } from "../dataset/item";
import { type DependencyVulnDetails, DEPENDENCY_VULN } from "../dataset/kinds/dependency-vuln";
import { registerScorer, type Scorer } from "./registry";
import { registerFieldCatalog } from "./field-catalog";
import { registerDefaultModel } from "./default-model";
import type { ScoreModel } from "./score-model";

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
registerFieldCatalog(DEPENDENCY_VULN, [
  { name: "severity", type: "enum", values: ["critical", "high", "medium", "low"] },
  { name: "cvss", type: "number", range: [0, 10] },
  { name: "fixAvailable", type: "bool" },
  { name: "scope", type: "enum", values: ["runtime", "development"] },
]);
registerDefaultModel(DEPENDENCY_VULN, {
  kind: DEPENDENCY_VULN,
  scale: 100,
  signals: {
    severity: { from: "severity", transform: { type: "enum", map: { critical: 1, high: 0.7, medium: 0.4, low: 0.1 } } },
    cvss: { from: "cvss", transform: { type: "linear", in: [0, 10] } },
    fix: { from: "fixAvailable", transform: { type: "bool" } },
  },
  formula: "severity * 0.6 + cvss * 0.3 + fix * 0.1",
  tiers: [{ name: "P0", min: 80 }, { name: "P1", min: 50 }, { name: "P2", min: 25 }, { name: "P3", min: 0 }],
} satisfies ScoreModel);
