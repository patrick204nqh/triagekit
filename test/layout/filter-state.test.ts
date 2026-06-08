// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { emptyListState, applyFilters, type ListState } from "../../src/runtime/layout/toolbar/filter-state";
import "../../src/runtime/layout/toolbar/axis-registry";   // ensure built-ins are registered
import type { ScoredItem } from "../../src/runtime/layout/table/kind-renderer";

function row(over: Partial<ScoredItem> & { details?: unknown }): ScoredItem {
  return {
    id: "x", source: "github", kind: "change-request", title: "t", location: "acme/web",
    signal: 0, createdAt: "2026-01-01T00:00:00Z", url: "", details: {}, score: 50, tier: "P2", ...over,
  } as ScoredItem;
}
const withAxes = (axes: ListState["axes"], sort = "priority"): ListState => ({ axes, sort });

describe("applyFilters (registry-driven)", () => {
  const rows: ScoredItem[] = [
    row({ id: "a", location: "acme/web", kind: "change-request", tier: "P0", score: 140, createdAt: "2026-01-01T00:00:00Z", details: { author: { kind: "human" } } }),
    row({ id: "b", location: "acme/api", kind: "issue",        tier: "P2", score: 70,  createdAt: "2026-03-01T00:00:00Z", details: { author: { kind: "bot" } } }),
    row({ id: "c", location: "acme/web", kind: "issue",        tier: "P3", score: 20,  createdAt: "2026-02-01T00:00:00Z", details: { author: { kind: "human" } } }),
  ];

  it("defaults to all, priority sort", () => {
    expect(applyFilters(rows, emptyListState()).map(r => r.id)).toEqual(["a", "b", "c"]);
  });
  it("filters by multi-value tier axis", () => {
    expect(applyFilters(rows, withAxes({ tier: ["P0", "P2"] })).map(r => r.id)).toEqual(["a", "b"]);
  });
  it("filters by author axis", () => {
    expect(applyFilters(rows, withAxes({ author: ["bot"] })).map(r => r.id)).toEqual(["b"]);
  });
  it("filters by labels axis", () => {
    const rs = [
      row({ id: "a", details: { labels: [{ name: "security", color: "" }] } }),
      row({ id: "b", details: { labels: [{ name: "bug", color: "" }] } }),
    ];
    expect(applyFilters(rs, withAxes({ labels: ["security"] })).map(r => r.id)).toEqual(["a"]);
  });
  it("empty axis value array = no filter", () => {
    expect(applyFilters(rows, withAxes({ tier: [] })).map(r => r.id)).toEqual(["a", "b", "c"]);
  });
  it("combines axes (AND)", () => {
    // tier=P2,P3 -> [b, c]; author=human -> [a, c]; intersection -> [c]
    expect(applyFilters(rows, withAxes({ tier: ["P2", "P3"], author: ["human"] })).map(r => r.id)).toEqual(["c"]);
  });
  it("recent sort", () => {
    expect(applyFilters(rows, withAxes({}, "recent")).map(r => r.id)).toEqual(["b", "c", "a"]);
  });
});
