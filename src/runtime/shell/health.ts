import type { ProviderDeclaration, Scope } from "../catalog/types";

export type Health = "connected" | "needs-token" | "upcoming";
export function healthOf(
  provider: ProviderDeclaration,
  credentials: { has(provider: string): boolean },
): Health {
  if (provider.status === "upcoming") return "upcoming";
  return credentials.has(provider.id) ? "connected" : "needs-token";
}
// Generic summary built from the Provider declaration's scope fields.
export function scopeSummary(provider: ProviderDeclaration, scope: Scope): string {
  const parts = provider.connection.scopeFields
    .map((f) => { const v = scope[f.key]; return Array.isArray(v) && v.length ? `${v.length} ${f.label.toLowerCase()}` : null; })
    .filter(Boolean) as string[];
  return parts.length ? parts.join(" · ") : "scope not set";
}
