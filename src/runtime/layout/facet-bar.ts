import type { ScoredItem } from "./triage-table";
import type { Kind } from "../dataset/item";
import type { Tier } from "../scoring/tier";

// Client-side filter axes the shell owns. WHERE (provider) is NOT here — it stays
// a fetch-level facet in app-shell. SCOPE/WHAT/STATE filter already-fetched rows.
export interface FacetState {
  scope: string;            // location, or "all"
  kind: Kind | "all";
  tiers: Set<Tier>;         // empty = all tiers
  author: "all" | "bot" | "human";
  sort: "priority" | "recent";
}

export function emptyFacetState(): FacetState {
  return { scope: "all", kind: "all", tiers: new Set(), author: "all", sort: "priority" };
}

// author.kind lives only on review items (ReviewDetails); read it defensively.
function authorKind(i: ScoredItem): string | undefined {
  return (i.details as { author?: { kind?: string } } | null | undefined)?.author?.kind;
}

// Pure: filter by scope/kind/tiers/author, then order by sort.
export function applyFacets(rows: ScoredItem[], s: FacetState): ScoredItem[] {
  const filtered = rows.filter(i =>
    (s.scope === "all" || i.location === s.scope) &&
    (s.kind === "all" || i.kind === s.kind) &&
    (s.tiers.size === 0 || s.tiers.has(i.tier)) &&
    (s.author === "all" || authorKind(i) === s.author));
  return [...filtered].sort(s.sort === "recent"
    ? (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)
    : (a, b) => b.score - a.score);
}
