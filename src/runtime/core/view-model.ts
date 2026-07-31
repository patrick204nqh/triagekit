// src/runtime/core/view-model.ts
import type { ScoredItem } from "../layout/table/kind-renderer";
import type { TriageFailure } from "../catalog/types";

export interface StoreStats {
  byProvider: Record<string, number>;
  byKind: Record<string, number>;
}

// What the core hands a ViewPort: pure data, no DOM, no behavior.
export interface ViewModel {
  scored: ScoredItem[];   // all active-kind rows, scored + sorted (the filter bar reads this)
  shown: ScoredItem[];    // rows after the active filter state
  errors: TriageFailure[];
  stats: StoreStats;      // dataset composition (byProvider, byKind)
}
