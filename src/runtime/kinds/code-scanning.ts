// src/runtime/kinds/code-scanning.ts
import type { KindDeclaration, Scorer } from "../catalog/types";
import type { Tier } from "../scoring/tier";
import type { CodeScanningDetails } from "../dataset/kinds/code-scanning";
import { codeScanningScore } from "../scoring/code-scanning";
import {
  codeScanningCharts,
  codeScanningRenderer,
  codeScanningSorts,
  codeScanningView,
  severityAxis,
  stateAxis,
  toolAxis,
} from "../views/code-security/code-scanning";

// Fields and defaultModel live in this declaration, the single source of truth.
// scoring/code-scanning.ts remains a pure score function.
// these into the registries.
export const codeScanningKind: KindDeclaration = {
  kind: "code-scanning",
  domain: "code-security",
  label: "Code scanning",
  status: "ready",
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
  sorts: codeScanningSorts,
  charts: codeScanningCharts,
  views: [codeScanningView],
  insights: {
    evidenced: (item) => {
      const details = item.details as CodeScanningDetails | undefined;
      return Boolean(
        details?.ruleId
        && details.tool
        && details.securitySeverity,
      );
    },
    dedupeKey: (item) => {
      const details = item.details as CodeScanningDetails | undefined;
      return details?.ruleId
        ? `${item.location}:${details.ruleId}:${details.location?.path ?? ""}`
        : undefined;
    },
  },
  projectTarget: (item) => {
    const d = item.details as CodeScanningDetails | undefined;
    return {
      title: item.title,
      location: item.location,
      providerReference: { ruleId: d?.ruleId ?? "", tool: d?.tool ?? "", securitySeverity: d?.securitySeverity ?? "low" },
      createdAt: item.createdAt,
      priority: { signal: item.signal, score: 0, tier: "P3" as Tier },
      details: { ruleId: d?.ruleId ?? "", ruleName: d?.ruleName ?? "", securitySeverity: d?.securitySeverity ?? "low", tool: d?.tool ?? "" },
    };
  },
};
