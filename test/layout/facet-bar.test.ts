import { describe, it, expect } from "vitest";
import { emptyFacetState, applyFacets } from "../../src/runtime/layout/facet-bar";
import type { ScoredItem } from "../../src/runtime/layout/triage-table";

function row(over: Partial<ScoredItem> & { details?: unknown }): ScoredItem {
  return {
    id: "x", source: "github", kind: "pull-request", title: "t",
    location: "acme/web", signal: 0, createdAt: "2026-01-01T00:00:00Z",
    url: "", details: {}, score: 50, tier: "P2", ...over,
  } as ScoredItem;
}

describe("applyFacets", () => {
  const rows: ScoredItem[] = [
    row({ id: "a", location: "acme/web",  kind: "pull-request", tier: "P0", score: 140, createdAt: "2026-01-01T00:00:00Z", details: { author: { kind: "human" } } }),
    row({ id: "b", location: "acme/api",  kind: "issue",        tier: "P2", score: 70,  createdAt: "2026-03-01T00:00:00Z", details: { author: { kind: "bot" } } }),
    row({ id: "c", location: "acme/web",  kind: "issue",        tier: "P3", score: 20,  createdAt: "2026-02-01T00:00:00Z", details: { author: { kind: "human" } } }),
  ];

  it("defaults to all, sorted by score desc", () => {
    expect(applyFacets(rows, emptyFacetState()).map(r => r.id)).toEqual(["a", "b", "c"]);
  });
  it("filters by scope", () => {
    expect(applyFacets(rows, { ...emptyFacetState(), scope: "acme/web" }).map(r => r.id)).toEqual(["a", "c"]);
  });
  it("filters by kind", () => {
    expect(applyFacets(rows, { ...emptyFacetState(), kind: "issue" }).map(r => r.id)).toEqual(["b", "c"]);
  });
  it("filters by tiers (empty set = all)", () => {
    const s = { ...emptyFacetState(), tiers: new Set(["P0", "P2"] as const) };
    expect(applyFacets(rows, s).map(r => r.id)).toEqual(["a", "b"]);
  });
  it("filters by author kind", () => {
    expect(applyFacets(rows, { ...emptyFacetState(), author: "bot" }).map(r => r.id)).toEqual(["b"]);
  });
  it("sorts by recent (createdAt desc)", () => {
    expect(applyFacets(rows, { ...emptyFacetState(), sort: "recent" }).map(r => r.id)).toEqual(["b", "c", "a"]);
  });
});
