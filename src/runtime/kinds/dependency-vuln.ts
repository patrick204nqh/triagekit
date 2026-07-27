// src/runtime/kinds/dependency-vuln.ts
import type { KindDeclaration, Scorer } from "../catalog/types";
import { dependencyVulnScore } from "../scoring/dependency-vuln";
import {
  dependencyVulnCharts,
  dependencyVulnRenderer,
  dependencyVulnSorts,
  dependencyVulnView,
  fixAvailableAxis,
  severityAxis,
} from "../views/code-security/view";

// Fields and defaultModel live in this declaration, the single source of truth.
// scoring/dependency-vuln.ts remains a pure score function.
// these into the registries.
export const dependencyVulnKind: KindDeclaration = {
  kind: "dependency-vuln",
  domain: "code-security",
  label: "Dependencies",
  status: "ready",
  fields: [
    { name: "severity", type: "enum", values: ["critical", "high", "medium", "low"] },
    { name: "cvss", type: "number", range: [0, 10] },
    { name: "fixAvailable", type: "bool" },
    { name: "scope", type: "enum", values: ["runtime", "development"] },
  ],
  builtInScorer: dependencyVulnScore as Scorer,
  defaultModel: {
    kind: "dependency-vuln",
    scale: 100,
    signals: {
      severity: { from: "severity", transform: { type: "enum", map: { critical: 1, high: 0.7, medium: 0.4, low: 0.1 } } },
      cvss: { from: "cvss", transform: { type: "linear", in: [0, 10] } },
      fix: { from: "fixAvailable", transform: { type: "bool" } },
    },
    formula: "severity * 0.6 + cvss * 0.3 + fix * 0.1",
    tiers: [{ name: "P0", min: 80 }, { name: "P1", min: 50 }, { name: "P2", min: 25 }, { name: "P3", min: 0 }],
  },
  renderer: dependencyVulnRenderer,
  filters: [severityAxis, fixAvailableAxis],
  sorts: dependencyVulnSorts,
  charts: dependencyVulnCharts,
  views: [dependencyVulnView],
};
