// src/runtime/core/scope-key.ts
import type { Scope } from "../ingest/source";

// Stable identity for one provider's scope selection. Sorting top-level keys makes
// it order-independent; nested arrays/objects keep their own order (selections are
// stable in practice). Used by the store to address a provider+scope slice.
export function scopeKey(scope: Scope): string {
  return JSON.stringify(scope, Object.keys(scope).sort());
}
