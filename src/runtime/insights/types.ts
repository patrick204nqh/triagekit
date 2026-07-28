import type { TriageItem } from "../dataset/item";

export interface InsightCapabilities {
  actionable?(item: TriageItem): boolean;
  owned?(item: TriageItem): boolean;
  evidenced?(item: TriageItem): boolean;
  dedupeKey?(item: TriageItem): string | undefined;
}

export type CoverageMetric =
  | Readonly<{
      status: "available";
      numerator: number;
      denominator: number;
      ratio: number;
    }>
  | Readonly<{ status: "unavailable" }>;
