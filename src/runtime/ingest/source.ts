import type { Kind, TriageItem } from "../dataset/item";
import type { DomainId } from "../dataset/taxonomy";

export type Scope = Record<string, unknown>;             // per-source, provider-defined bag
export interface TriageError { target: string; message: string; }
export interface TriageResult { items: TriageItem[]; errors: TriageError[]; }

// Declarative scope field (Plan 2 renders the Settings form from these).
export interface ScopeField {
  key: string; label: string;
  type: "multiselect" | "text" | "select";
  discoverable?: boolean; required?: boolean;
}
export interface DiscoveryOption { value: string; label: string; group?: string; }

export interface Source {
  id: string;
  provider?: string;   // credential/scope are keyed by this; defaults to `id`. Lets two
                       // sources (e.g. github alerts + github reviews) share one connection.
  domain: DomainId;
  kinds: Kind[];
  connectSrc: string[];
  status: "ready" | "upcoming";
  setup?: { hint: string; url?: string };   // how to create the credential (shown in Settings)
  scopeSchema: ScopeField[];
  discover?(token: string): Promise<DiscoveryOption[]>;   // Plan 2 (GitHub)
  fetch(scope: Scope, token: string): Promise<TriageResult>;
}

const sources = new Map<string, Source>();
export function registerSource(s: Source) { sources.set(s.id, s); }
export function getSource(id: string): Source {
  const s = sources.get(id); if (!s) throw new Error(`unknown source: ${id}`); return s;
}
export function listSources(): Source[] { return [...sources.values()]; }
export function providerOf(s: Source): string { return s.provider ?? s.id; }
export function allConnectSrc(): string[] {
  return [...new Set(listSources().flatMap(s => s.connectSrc))];
}
