import { describe, it, expect } from "vitest";
import {
  codeScanningScore,
  explainCodeScanningScore,
} from "../../src/runtime/scoring/code-scanning";
import type { TriageItem } from "../../src/runtime/dataset/item";
import type { CodeScanningDetails } from "../../src/runtime/dataset/kinds/code-scanning";

const item = (d: Partial<CodeScanningDetails>): TriageItem<CodeScanningDetails> => ({
  id: "x", provider: "github", providerRef: {}, kind: "code-scanning", title: "t", location: "acme/api",
  signal: 0, createdAt: new Date().toISOString(), url: "",
  details: {
    ruleId: "r", ruleName: "R", securitySeverity: "low", tool: "CodeQL",
    location: { path: "a.ts", line: 1 }, state: "open", permalink: "", ...d,
  },
});

describe("codeScanningScore", () => {
  it("ranks critical above low", () => {
    expect(codeScanningScore(item({ securitySeverity: "critical" })))
      .toBeGreaterThan(codeScanningScore(item({ securitySeverity: "low" })));
  });
  it("damps dismissed/fixed below open at equal severity", () => {
    const open = codeScanningScore(item({ securitySeverity: "high", state: "open" }));
    const fixed = codeScanningScore(item({ securitySeverity: "high", state: "fixed" }));
    expect(fixed).toBeLessThan(open);
  });
  it("explains the same fixed-time score through additive factors", () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    const candidate = item({ securitySeverity: "high", state: "open" });
    const explanation = explainCodeScanningScore(candidate, now);
    expect(explanation.score).toBe(codeScanningScore(candidate, now));
    expect(explanation.factors.reduce(
      (total, factor) => total + factor.contribution,
      0,
    )).toBe(explanation.score);
  });
});
