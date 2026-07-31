import type { ProviderDeclaration, Scope } from "../catalog/types";

// Generic summary built from the Provider declaration's scope fields.
export function scopeSummary(provider: ProviderDeclaration, scope: Scope): string {
  const parts = provider.connection.scopeFields
    .map((f) => { const v = scope[f.key]; return Array.isArray(v) && v.length ? `${v.length} ${f.label.toLowerCase()}` : null; })
    .filter(Boolean) as string[];
  return parts.length ? parts.join(" · ") : "scope not set";
}
