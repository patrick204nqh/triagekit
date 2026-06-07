// src/runtime/core/store.ts
// STUB — Task 3 will implement the full store.
// Only StoreStats is defined here so that view-model.ts compiles without a
// forward dependency on an unimplemented module.

export interface StoreStats {
  byProvider: Record<string, number>;
  byKind: Record<string, number>;
}
