// src/runtime/scoring/code-scanning.ts
import { type CodeScanningDetails } from "../dataset/kinds/code-scanning";
import { makeSeverityScoring } from "./severity-scorer";

const scoring = makeSeverityScoring<CodeScanningDetails>({
  severity: d => d.securitySeverity,
  factors: [{
    label: "State",
    raw: d => d.state,
    contribution: d => d.state === "open" ? 15 : d.state === "dismissed" ? -25 : d.state === "fixed" ? -40 : 0,
    reason: d => `${d.state} finding`,
  }],
  clampZero: true,
});

export const codeScanningScore = scoring.score;
export const explainCodeScanningScore = scoring.explain;
