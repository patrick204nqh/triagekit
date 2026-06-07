import { describe, it, expect } from "vitest";
import { CODE_SCANNING, type CodeScanningDetails } from "../../src/runtime/dataset/kinds/code-scanning";

describe("code-scanning dataset type", () => {
  it("exposes the kind constant", () => {
    expect(CODE_SCANNING).toBe("code-scanning");
  });
  it("shapes a finding", () => {
    const d: CodeScanningDetails = {
      ruleId: "js/sql-injection", ruleName: "SQL injection",
      securitySeverity: "high", tool: "CodeQL",
      location: { path: "src/db.ts", line: 42 }, state: "open",
      permalink: "https://github.com/acme/api/security/code-scanning/7",
    };
    expect(d.securitySeverity).toBe("high");
  });
});
