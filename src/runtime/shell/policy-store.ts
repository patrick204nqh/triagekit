import { DEFAULT_THRESHOLDS, type TierThresholds } from "../scoring/tier";

// Rarely-changed triage policy — non-secret, localStorage, survives sessions.
const TIERS_KEY = "triagekit.policy.tiers";
const BOTS_KEY = "triagekit.policy.botLogins";

export class PolicyStore {
  getTiers(): TierThresholds {
    try { return { ...DEFAULT_THRESHOLDS, ...JSON.parse(localStorage.getItem(TIERS_KEY) ?? "{}") }; } catch { return { ...DEFAULT_THRESHOLDS }; }
  }
  setTiers(t: TierThresholds): void { localStorage.setItem(TIERS_KEY, JSON.stringify(t)); }

  getBotLogins(): string[] {
    try {
      const v = JSON.parse(localStorage.getItem(BOTS_KEY) ?? "[]");
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    } catch { return []; }
  }
  setBotLogins(logins: string[]): void { localStorage.setItem(BOTS_KEY, JSON.stringify(logins)); }
}
