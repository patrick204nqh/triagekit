// src/runtime/core/derivation.ts
import type { Kind, TriageItem } from "../dataset/item";
import { scoreAndTier, type ScoreContext } from "../scoring/configured";
import { withBotPolicy } from "./author-policy";
import { applyFilters, type ListState } from "../layout/filter-state";
import type { ScoredItem } from "../layout/triage-table";

export interface DeriveInput {
  items: readonly TriageItem[];
  activeKinds: readonly Kind[];
  botLogins: string[];
  score: ScoreContext;
  repo: string;            // "" = all repos
  filters: ListState;
}
export interface Derived {
  scored: ScoredItem[];   // active-kind items, bot-policy applied, scored + sorted (pre-filter)
  shown: ScoredItem[];    // scored filtered through the filter state
}

// Mirrors app-shell.ts:209-223 exactly, as a pure function over a snapshot.
export function derive(input: DeriveInput): Derived {
  const scored = input.items
    .filter(it => input.activeKinds.includes(it.kind))
    .map(it => withBotPolicy(it, input.botLogins))
    .map(it => {
      const { score, tier } = scoreAndTier(it, input.score);
      return { ...it, score, tier } as ScoredItem;
    })
    .sort((a, b) => b.score - a.score);
  const scoped = input.repo && scored.some(r => r.location === input.repo)
    ? scored.filter(r => r.location === input.repo)
    : scored;
  const shown = applyFilters(scoped, input.filters);
  return { scored, shown };
}
