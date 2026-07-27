import type { Kind, TriageItem } from "../dataset/item";
import { runtimeCatalog } from "../catalog/built-in";
import type { RuntimeCatalog, Scorer } from "../catalog/types";
import type { Tier, TierThresholds } from "./tier";
import { tierOf } from "./tier";
import { evalScoreModel, tierFromBands, validateModel, type ScoreModel } from "./score-model";
import type { FieldDef } from "./field-catalog";

export interface ScoreContext {
  getModel(kind: string): ScoreModel | null;
  getFields(kind: Kind): readonly FieldDef[];
  getThresholds(): TierThresholds;
  override?: Scorer;
}

export interface Scored { score: number; tier: Tier; }

// Prefer a valid configured model; otherwise the built-in scorer + tier thresholds.
// A configured-but-invalid model never throws into the render path — it falls back.
export function scoreAndTier(
  item: TriageItem,
  ctx: ScoreContext,
  catalog: RuntimeCatalog = runtimeCatalog,
): Scored {
  const model = ctx.getModel(item.kind);
  const fields = catalog.fieldsFor(item.kind);
  if (model && validateModel(model, fields).length === 0) {
    try {
      const score = evalScoreModel(model, item);
      return { score, tier: tierFromBands(score, model.tiers) as Tier };
    } catch {
      // A model that passed validation but still threw must not break the render
      // path — fall through to the built-in scorer.
    }
  }
  const scorer = ctx.override
    ?? catalog.readyKind(item.kind)?.builtInScorer
    ?? ((candidate: TriageItem) => candidate.signal);
  const score = scorer(item);
  return { score, tier: tierOf(score, ctx.getThresholds()) };
}
