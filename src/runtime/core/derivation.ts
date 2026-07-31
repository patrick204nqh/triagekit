// src/runtime/core/derivation.ts
import type { Kind, TriageItem } from "../dataset/item";
import { runtimeCatalog } from "../catalog/built-in";
import type { RuntimeCatalog } from "../catalog/types";
import { scoreAndTier, type ScoreContext } from "../scoring/configured";
import { withBotPolicy } from "./author-policy";
import { applyFilters, type ListState } from "../layout/toolbar/filter-state";
import type { ScoredItem } from "../layout/table/kind-renderer";
import type { FocusPolicySnapshot } from "../focus/types";
import { compareFocusedItems } from "../focus/policy";

export interface DeriveInput {
  items: readonly TriageItem[];
  activeKinds: readonly Kind[];
  botLogins: string[];
  score: ScoreContext;
  repoView: string;        // "" = all repos (display-filter; not fetch-config Scope)
  filters: ListState;
  focusPolicy: FocusPolicySnapshot;
  catalog?: RuntimeCatalog;
}
export interface Derived {
  scored: ScoredItem[];   // active-kind items, bot-policy applied, scored + sorted (pre-filter)
  shown: ScoredItem[];    // scored filtered through the filter state
}

// Mirrors app-shell.ts:209-223 exactly, as a pure function over a snapshot.
export function derive(input: DeriveInput): Derived {
  const catalog = input.catalog ?? runtimeCatalog;
  const scored = input.items
    .filter(it => input.activeKinds.includes(it.kind))
    .map((item) => withBotPolicy(item, input.botLogins))
    .map(it => {
      return { ...it, ...scoreAndTier(it, input.score, catalog) } as ScoredItem;
    })
    .sort(compareFocusedItems(input.focusPolicy.repositoryOrder));
  const scoped = input.repoView && scored.some(r => r.location === input.repoView)
    ? scored.filter(r => r.location === input.repoView)
    : scored;
  const shown = applyFilters(scoped, input.filters, catalog, input.focusPolicy);
  return { scored, shown };
}
