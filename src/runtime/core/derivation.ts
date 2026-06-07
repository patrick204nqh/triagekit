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
  facets: ListState;
}
export interface Derived {
  scored: ScoredItem[];   // active-kind items, bot-policy applied, scored + sorted (pre-facet)
  shown: ScoredItem[];    // scored filtered through the facet state
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
  const shown = applyFilters(scored, input.facets);
  return { scored, shown };
}
