// src/runtime/core/store.ts
import type { TriageItem } from "../dataset/item";

export interface Provenance {
  provider: string;    // e.g. "github" — the providerOf(source) value
  scopeKey: string;    // serialized scope identity for that provider+scope
  fetchedAt: number;   // epoch ms
}
export interface StoreEntry { item: TriageItem; provenance: Provenance; }
export interface StoreStats {
  byProvider: Record<string, number>;
  byKind: Record<string, number>;
}

// Provider-agnostic identity. Defaults to the item id (`source:native_id`),
// which is already stable per provider. A per-kind/custom fingerprint enables
// future cross-tool merge — not used by production wiring yet.
export type Fingerprint = (item: TriageItem) => string;
const defaultFingerprint: Fingerprint = (it) => it.id;

export function createStore(fingerprint: Fingerprint = defaultFingerprint) {
  const entries = new Map<string, StoreEntry>();

  function upsert(items: readonly TriageItem[], provenance: Provenance): void {
    for (const item of items) entries.set(fingerprint(item), { item, provenance });
  }

  // Swap one provider+scope slice atomically: drop its prior entries, add the new.
  function replaceScope(provider: string, scopeKey: string, items: readonly TriageItem[], fetchedAt: number): void {
    for (const [fp, e] of entries) {
      if (e.provenance.provider === provider && e.provenance.scopeKey === scopeKey) entries.delete(fp);
    }
    upsert(items, { provider, scopeKey, fetchedAt });
  }

  function remove(fingerprints: string[]): void {
    for (const fp of fingerprints) entries.delete(fp);
  }

  function snapshot(): readonly TriageItem[] {
    return [...entries.values()].map(e => e.item);
  }

  function stats(): StoreStats {
    const byProvider: Record<string, number> = {};
    const byKind: Record<string, number> = {};
    for (const e of entries.values()) {
      byProvider[e.provenance.provider] = (byProvider[e.provenance.provider] ?? 0) + 1;
      byKind[e.item.kind] = (byKind[e.item.kind] ?? 0) + 1;
    }
    return { byProvider, byKind };
  }

  return { upsert, replaceScope, remove, snapshot, stats };
}

export type DatasetStore = ReturnType<typeof createStore>;
