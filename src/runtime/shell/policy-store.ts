import { DEFAULT_THRESHOLDS, type TierThresholds } from "../scoring/tier";

// Rarely-changed triage policy — non-secret, localStorage, survives sessions.
const TIERS_KEY = "triagekit.policy.tiers";

export class PolicyStore {
  getTiers(): TierThresholds {
    try { return { ...DEFAULT_THRESHOLDS, ...JSON.parse(localStorage.getItem(TIERS_KEY) ?? "{}") }; } catch { return { ...DEFAULT_THRESHOLDS }; }
  }
  setTiers(t: TierThresholds): void { localStorage.setItem(TIERS_KEY, JSON.stringify(t)); }
}
