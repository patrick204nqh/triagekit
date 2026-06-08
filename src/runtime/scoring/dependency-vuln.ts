// src/runtime/scoring/dependency-vuln.ts
import { type DependencyVulnDetails } from "../dataset/kinds/dependency-vuln";
import { makeSeverityScorer } from "./severity-scorer";

export const dependencyVulnScore = makeSeverityScorer<DependencyVulnDetails>({
  severity: d => d.severity,
  adjust: d => d.cvss * 3
             + (d.fixAvailable ? 25 : 0)
             + (d.scope === "runtime" ? 15 : d.scope === "development" ? -10 : 0),
});
