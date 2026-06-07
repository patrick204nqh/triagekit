export const CODE_SCANNING = "code-scanning" as const;

export type CodeScanningSeverity = "critical" | "high" | "medium" | "low";
export type CodeScanningState = "open" | "dismissed" | "fixed";

export interface CodeScanningDetails {
  ruleId: string;
  ruleName: string;
  securitySeverity: CodeScanningSeverity;
  tool: string;                          // e.g. "CodeQL"
  location: { path: string; line: number };
  state: CodeScanningState;
  permalink: string;
}
