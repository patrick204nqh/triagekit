// src/runtime/scoring/dependency-vuln.ts
import { type DependencyVulnDetails } from "../dataset/kinds/dependency-vuln";
import { makeSeverityScoring } from "./severity-scorer";

const scoring = makeSeverityScoring<DependencyVulnDetails>({
  severity: d => d.severity,
  factors: [
    {
      label: "CVSS",
      raw: d => d.cvss,
      contribution: d => d.cvss * 3,
      reason: d => `CVSS ${d.cvss}`,
    },
    {
      label: "Fix",
      raw: d => d.fixAvailable,
      contribution: d => d.fixAvailable ? 25 : 0,
      reason: d => d.fixAvailable ? "fix available" : "no fix available",
    },
    {
      label: "Scope",
      raw: d => d.scope,
      contribution: d => d.scope === "runtime" ? 15 : d.scope === "development" ? -10 : 0,
      reason: d => `${d.scope} dependency`,
    },
  ],
});

export const dependencyVulnScore = scoring.score;
export const explainDependencyVulnScore = scoring.explain;
