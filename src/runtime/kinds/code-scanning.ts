// src/runtime/kinds/code-scanning.ts
import type { KindManifest } from "../core/manifest";
import type { Scorer } from "../scoring/registry";
import { codeScanningScore } from "../scoring/code-scanning";
import { codeScanningRenderer, severityAxis, toolAxis, stateAxis } from "../views/code-scanning/view";

// Fields + defaultModel live here in the manifest (the single source of truth).
// scoring/code-scanning.ts is a pure score function; registerKinds wires
// these into the registries.
export const codeScanningKind: KindManifest = {
  kind: "code-scanning",
  domain: "code-security",
  fields: [
    { name: "securitySeverity", type: "enum", values: ["critical", "high", "medium", "low"] },
    { name: "state", type: "enum", values: ["open", "dismissed", "fixed"] },
  ],
  builtInScorer: codeScanningScore as Scorer,
  // Severity-only display model for tier labelling; the built-in scorer (scoring/code-scanning.ts) additionally weights state + age.
  defaultModel: {
    kind: "code-scanning",
    scale: 100,
    signals: {
      severity: { from: "securitySeverity", transform: { type: "enum", map: { critical: 1, high: 0.7, medium: 0.4, low: 0.1 } } },
    },
    formula: "severity * 100",
    tiers: [{ name: "P0", min: 80 }, { name: "P1", min: 50 }, { name: "P2", min: 25 }, { name: "P3", min: 0 }],
  },
  renderer: codeScanningRenderer,
  filters: [severityAxis, toolAxis, stateAxis],
};
