// src/runtime/core/register-kinds.ts
import type { KindManifest } from "./manifest";
import { registerScorer } from "../scoring/registry";
import { registerFieldCatalog } from "../scoring/field-catalog";
import { registerKindRenderer } from "../layout/table/kind-renderer";
import { registerFilterAxis } from "../layout/toolbar/axis-registry";
import { registerDefaultModel } from "../scoring/default-model";

// Expand each manifest into the runtime registries, after validating completeness.
export function registerKinds(manifests: KindManifest[]): void {
  for (const m of manifests) {
    if (!m.renderer) throw new Error(`kind "${m.kind}": missing renderer`);
    if (!m.builtInScorer) throw new Error(`kind "${m.kind}": missing builtInScorer`);
    if (!m.fields) throw new Error(`kind "${m.kind}": missing fields`);

    registerScorer(m.kind, m.builtInScorer);
    registerFieldCatalog(m.kind, m.fields);
    registerKindRenderer(m.renderer);
    if (m.defaultModel) registerDefaultModel(m.kind, m.defaultModel);
    for (const axis of m.filters ?? []) registerFilterAxis(axis);
  }
}
