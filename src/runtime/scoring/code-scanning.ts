// src/runtime/scoring/code-scanning.ts
import { type CodeScanningDetails } from "../dataset/kinds/code-scanning";
import { makeSeverityScorer } from "./severity-scorer";

export const codeScanningScore = makeSeverityScorer<CodeScanningDetails>({
  severity: d => d.securitySeverity,
  adjust: d => d.state === "open" ? 15 : d.state === "dismissed" ? -25 : d.state === "fixed" ? -40 : 0,
  clampZero: true,
});
