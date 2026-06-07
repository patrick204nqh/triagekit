// src/runtime/kinds/dependency-vuln.ts
import type { KindManifest } from "../core/manifest";
import type { Scorer } from "../scoring/registry";
import { dependencyVulnScore } from "../scoring/dependency-vuln";
import { dependencyVulnRenderer, severityAxis, fixAvailableAxis } from "../views/security-alerts/view";

// Fields + defaultModel lifted verbatim from scoring/dependency-vuln.ts (the live
// registerFieldCatalog / registerDefaultModel calls remain there until Plan 3).
export const dependencyVulnKind: KindManifest = {
  kind: "dependency-vuln",
  domain: "code-security",
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
};
