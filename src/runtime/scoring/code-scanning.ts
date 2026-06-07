import type { TriageItem } from "../dataset/item";
import { type CodeScanningDetails } from "../dataset/kinds/code-scanning";

export function codeScanningScore(item: TriageItem<CodeScanningDetails>): number {
  const d = item.details;
  const base = { critical: 100, high: 70, medium: 40, low: 10 }[d.securitySeverity] ?? 0;
  let score = base;
  if (d.state === "open") score += 15;
  else if (d.state === "dismissed") score -= 25;
  else if (d.state === "fixed") score -= 40;
  const ageDays = (Date.now() - +new Date(item.createdAt)) / 86400000;
  score += Math.min(ageDays / 7, 15);
  return Math.round(Math.max(0, score));
}
