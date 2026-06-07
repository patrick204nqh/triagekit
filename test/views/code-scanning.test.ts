// @vitest-environment jsdom
// test/views/code-scanning.test.ts
import { describe, it, expect } from "vitest";
import { codeScanningRenderer, toolAxis, stateAxis, severityAxis, renderByTool } from "../../src/runtime/views/code-security/code-scanning";
import type { ScoredItem } from "../../src/runtime/layout/triage-table";
import type { CodeScanningDetails } from "../../src/runtime/dataset/kinds/code-scanning";

const row = (d: Partial<CodeScanningDetails>): ScoredItem => ({
  id: "x", source: "github", kind: "code-scanning", title: "SQL injection",
  location: "acme/api", signal: 0, createdAt: "2026-01-01T00:00:00Z", url: "u",
  score: 80, tier: "P0",
  details: {
    ruleId: "js/sqli", ruleName: "SQL injection", securitySeverity: "high", tool: "CodeQL",
    location: { path: "src/db.ts", line: 42 }, state: "open", permalink: "p", ...d,
  },
} as ScoredItem);

describe("code-scanning renderer", () => {
  it("renders rule + severity columns", () => {
    const cells = codeScanningRenderer.columns.map(c => c.cell(row({})));
    expect(cells.join(" ")).toContain("SQL injection");
    expect(cells.join(" ")).toContain("high");
  });
  it("renders a detail panel with location and tool", () => {
    const host = document.createElement("div");
    codeScanningRenderer.detail!(host, row({}), {} as any);
    expect(host.innerHTML).toContain("src/db.ts");
    expect(host.innerHTML).toContain("CodeQL");
  });
  it("derives tool options from data", () => {
    const opts = toolAxis.optionsFrom([row({ tool: "CodeQL" }), row({ tool: "ESLint" })], {} as any);
    expect(opts.map(o => o.value).sort()).toEqual(["CodeQL", "ESLint"]);
  });
  it("filters by state", () => {
    expect(stateAxis.test(row({ state: "open" }), ["open"])).toBe(true);
    expect(stateAxis.test(row({ state: "fixed" }), ["open"])).toBe(false);
  });
  it("severityAxis returns options ordered critical → high → medium → low", () => {
    const rows = [
      row({ securitySeverity: "low" }),
      row({ securitySeverity: "critical" }),
      row({ securitySeverity: "medium" }),
      row({ securitySeverity: "high" }),
    ];
    const opts = severityAxis.optionsFrom(rows, {} as any);
    expect(opts.map(o => o.value)).toEqual(["critical", "high", "medium", "low"]);
  });
  it("cs-by-tool chart ignores non-code-scanning rows", () => {
    const csRow = row({ tool: "CodeQL" });
    const alienRow = { kind: "dependency-vuln", details: {} } as any as ScoredItem;
    const el = document.createElement("div");
    renderByTool([csRow, alienRow], el);
    expect(el.innerHTML).not.toContain("undefined");
    expect(el.innerHTML).toContain("CodeQL");
  });
});
