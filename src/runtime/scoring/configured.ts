import type { Kind, TriageItem } from "../dataset/item";
import { runtimeCatalog } from "../catalog/built-in";
import type { RuntimeCatalog, Scorer } from "../catalog/types";
import type { Tier, TierThresholds } from "./tier";
import { tierOf } from "./tier";
import {
  explainScoreModel,
  tierFromBands,
  validateModel,
  type ScoreExplanation,
  type ScoreModel,
} from "./score-model";
import type { FieldDef } from "./field-catalog";

export interface ScoreContext {
  getModel(kind: string): ScoreModel | null;
  getFields(kind: Kind): readonly FieldDef[];
  getThresholds(): TierThresholds;
  override?: Scorer;
}

export interface Scored {
  score: number;
  tier: Tier;
  explanation: ScoreExplanation;
}

// Prefer a valid configured model; otherwise the built-in scorer + tier thresholds.
// A configured-but-invalid model never throws into the render path — it falls back.
export function scoreAndTier(
  item: TriageItem,
  ctx: ScoreContext,
  catalog: RuntimeCatalog = runtimeCatalog,
  now = Date.now(),
): Scored {
  const model = ctx.getModel(item.kind);
  const fields = catalog.fieldsFor(item.kind);
  if (model && validateModel(model, fields).length === 0) {
    try {
      const explanation = explainScoreModel(model, item, now);
      return {
        score: explanation.score,
        tier: tierFromBands(explanation.score, model.tiers) as Tier,
        explanation,
      };
    } catch {
      // A model that passed validation but still threw must not break the render
      // path — fall through to the built-in scorer.
    }
  }
  const scorer = ctx.override
    ?? catalog.readyKind(item.kind)?.builtInScorer
    ?? ((candidate: TriageItem) => candidate.signal);
  const score = scorer(item, now);
  let explanation: Extract<ScoreExplanation, { source: "built-in" }> = {
    source: "built-in",
    score,
    factors: [],
  };
  try {
    const explained = catalog.readyKind(item.kind)?.explainBuiltInScore(item, now);
    if (explained?.score === score) explanation = explained;
  } catch {
    // A scorer explanation is supplemental and must not break list rendering.
  }
  return { score, tier: tierOf(score, ctx.getThresholds()), explanation };
}
