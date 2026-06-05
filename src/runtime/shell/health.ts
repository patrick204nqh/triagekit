import type { Scope, Source } from "../ingest/source";
import type { CredStore } from "./cred-store";

export type Health = "connected" | "needs-token" | "upcoming";
export function healthOf(source: Source, creds: CredStore): Health {
  if (source.status === "upcoming") return "upcoming";
  return creds.has(source.id) ? "connected" : "needs-token";
}
// Generic, provider-agnostic summary built from the source's own scopeSchema.
export function scopeSummary(source: Source, scope: Scope): string {
  const parts = source.scopeSchema
    .map((f) => { const v = scope[f.key]; return Array.isArray(v) && v.length ? `${v.length} ${f.label.toLowerCase()}` : null; })
    .filter(Boolean) as string[];
  return parts.length ? parts.join(" · ") : "scope not set";
}
