import type { Kind, TriageItem } from "../dataset/item";
import type { Tier, TierThresholds } from "./tier";
import { tierOf } from "./tier";
import { resolveScorer, type Scorer } from "./registry";
import { evalScoreModel, tierFromBands, validateModel, type ScoreModel } from "./score-model";
import type { FieldDef } from "./field-catalog";

export interface ScoreContext {
  getModel(kind: string): ScoreModel | null;
  getFields(kind: Kind): FieldDef[];
  getThresholds(): TierThresholds;
  override?: Scorer;
}

export interface Scored { score: number; tier: Tier; }

// Prefer a valid configured model; otherwise the built-in scorer + tier thresholds.
// A configured-but-invalid model never throws into the render path — it falls back.
export function scoreAndTier(item: TriageItem, ctx: ScoreContext): Scored {
  const model = ctx.getModel(item.kind);
  if (model && validateModel(model, ctx.getFields(item.kind)).length === 0) {
    try {
      const score = evalScoreModel(model, item);
      return { score, tier: tierFromBands(score, model.tiers) as Tier };
    } catch {
      // A model that passed validation but still threw must not break the render
      // path — fall through to the built-in scorer.
    }
  }
  const score = resolveScorer(item.kind, ctx.override)(item);
  return { score, tier: tierOf(score, ctx.getThresholds()) };
}
