import { describe, it, expect } from "vitest";
import { codeScanningScore } from "../../src/runtime/scoring/code-scanning";
import type { TriageItem } from "../../src/runtime/dataset/item";
import type { CodeScanningDetails } from "../../src/runtime/dataset/kinds/code-scanning";

const item = (d: Partial<CodeScanningDetails>): TriageItem<CodeScanningDetails> => ({
  id: "x", source: "github", kind: "code-scanning", title: "t", location: "acme/api",
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
});
