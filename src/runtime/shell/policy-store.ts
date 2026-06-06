import { DEFAULT_THRESHOLDS, type TierThresholds } from "../scoring/tier";
import type { ScoreModel } from "../scoring/score-model";

// Rarely-changed triage policy — non-secret, localStorage, survives sessions.
const TIERS_KEY = "triagekit.policy.tiers";
const SCORE_PREFIX = "triagekit.policy.score.";

export class PolicyStore {
  getTiers(): TierThresholds {
    try { return { ...DEFAULT_THRESHOLDS, ...JSON.parse(localStorage.getItem(TIERS_KEY) ?? "{}") }; } catch { return { ...DEFAULT_THRESHOLDS }; }
  }
  setTiers(t: TierThresholds): void { localStorage.setItem(TIERS_KEY, JSON.stringify(t)); }

  getScoreModel(kind: string): ScoreModel | null {
    try {
      const raw = localStorage.getItem(SCORE_PREFIX + kind);
      return raw ? (JSON.parse(raw) as ScoreModel) : null;
    } catch { return null; }
  }
  setScoreModel(kind: string, model: ScoreModel): void {
    localStorage.setItem(SCORE_PREFIX + kind, JSON.stringify(model));
  }
  clearScoreModel(kind: string): void { localStorage.removeItem(SCORE_PREFIX + kind); }
}
