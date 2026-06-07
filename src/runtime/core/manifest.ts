// src/runtime/core/manifest.ts
import type { Kind } from "../dataset/item";
import type { DomainId } from "../dataset/taxonomy";
import type { Scorer } from "../scoring/registry";
import type { FieldDef } from "../scoring/field-catalog";
import type { ScoreModel } from "../scoring/score-model";
import type { KindRenderer } from "../layout/triage-table";
import type { FilterAxis } from "../layout/facet-registry";
import type { Source } from "../ingest/source";

// Everything one kind needs, declared in one place. registerKinds expands it.
export interface KindManifest {
  kind: Kind;
  domain: DomainId;
  fields: FieldDef[];              // the contract scoring/UI rely on
  builtInScorer: Scorer;
  defaultModel?: ScoreModel;       // seed/Reset target
  renderer: KindRenderer;
  filters?: FilterAxis[];          // kind-specific axes (cross-kind axes stay global)
}

// One provider, declared in one place. makeAdapter returns a Source (already a
// structural ProviderPort). deps carries the live cred/scope accessors.
export interface ProviderManifest {
  id: string;
  domain: DomainId;
  kinds: Kind[];
  labels?: Partial<Record<Kind, string>>;   // provider's display noun per kind
  makeAdapter(deps: unknown): Source;
}
