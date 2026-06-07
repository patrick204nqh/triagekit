import type { TriageItem } from "../dataset/item";
import type { ScoreModel } from "./score-model";
import type { Tier } from "./tier";
import { evalScoreModel, tierFromBands } from "./score-model";

export interface PreviewRow { item: TriageItem; score: number; tier: Tier; }

// Re-rank rows by a (validated) draft model: score each, sort desc, take topN.
// Takes TriageItem[] (not ScoredItem) so scoring/ stays free of layout/ deps.
// Per-row try/catch: a row that fails to score is dropped, never fails the batch.
export function previewRerank(model: ScoreModel, rows: TriageItem[], topN: number): PreviewRow[] {
  const scored: PreviewRow[] = [];
  for (const item of rows) {
    try {
      const score = evalScoreModel(model, item);
      scored.push({ item, score, tier: tierFromBands(score, model.tiers) as Tier });
    } catch { /* skip rows that fail to score */ }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}
