// src/runtime/core/ports.ts
import type { Kind } from "../dataset/item";
import type { Scope, DiscoveryOption, TriageResult } from "../ingest/source";
import type { ViewModel } from "./view-model";

// Driven (secondary) ports: the core calls these; adapters implement them.

// A data source. Mirrors today's `Source.fetch/discover` so an existing Source
// is already a structural ProviderPort — Plan 2 adapters can reuse them.
export interface ProviderPort {
  id: string;
  kinds: Kind[];
  fetch(scope: Scope, token: string): Promise<TriageResult>;
  discover?(token: string): Promise<DiscoveryOption[]>;
}

// The core hands a ViewModel to whatever renders it (DOM in prod, fake in tests).
export interface ViewPort {
  render(vm: ViewModel): void;
}

// Persistence the core needs (scope/policy). Creds stay session-only, outside this.
export interface StoragePort {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

// Timed work (auto-refresh). Returns a cancel function.
export interface TimerPort {
  every(ms: number, fn: () => void): () => void;
}
