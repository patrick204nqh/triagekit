// src/runtime/core/view-model.ts
import type { ScoredItem } from "../layout/table/kind-renderer";
import type { TriageError } from "../ingest/source";
import type { StoreStats } from "./store";

// What the core hands a ViewPort: pure data, no DOM, no behavior.
export interface ViewModel {
  scored: ScoredItem[];   // all active-kind rows, scored + sorted (the filter bar reads this)
  shown: ScoredItem[];    // rows after the active filter state
  errors: TriageError[];  // fetch failures from the last refresh
  stats: StoreStats;      // dataset composition (byProvider, byKind)
}
