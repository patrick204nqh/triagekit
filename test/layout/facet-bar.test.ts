// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { emptyFacetState, applyFacets, type FacetState } from "../../src/runtime/layout/facet-bar";
import "../../src/runtime/layout/facet-registry";   // ensure built-ins are registered
import type { ScoredItem } from "../../src/runtime/layout/triage-table";

function row(over: Partial<ScoredItem> & { details?: unknown }): ScoredItem {
  return {
    id: "x", source: "github", kind: "pull-request", title: "t", location: "acme/web",
    signal: 0, createdAt: "2026-01-01T00:00:00Z", url: "", details: {}, score: 50, tier: "P2", ...over,
  } as ScoredItem;
}
const withAxes = (axes: FacetState["axes"], sort = "priority"): FacetState => ({ axes, sort });

describe("applyFacets (registry-driven)", () => {
  const rows: ScoredItem[] = [
    row({ id: "a", location: "acme/web", kind: "pull-request", tier: "P0", score: 140, createdAt: "2026-01-01T00:00:00Z", details: { author: { kind: "human" } } }),
    row({ id: "b", location: "acme/api", kind: "issue",        tier: "P2", score: 70,  createdAt: "2026-03-01T00:00:00Z", details: { author: { kind: "bot" } } }),
    row({ id: "c", location: "acme/web", kind: "issue",        tier: "P3", score: 20,  createdAt: "2026-02-01T00:00:00Z", details: { author: { kind: "human" } } }),
  ];

  it("defaults to all, priority sort", () => {
    expect(applyFacets(rows, emptyFacetState()).map(r => r.id)).toEqual(["a", "b", "c"]);
  });
  it("filters by scope axis", () => {
    expect(applyFacets(rows, withAxes({ scope: ["acme/web"] })).map(r => r.id)).toEqual(["a", "c"]);
  });
  it("filters by multi-value tier axis", () => {
    expect(applyFacets(rows, withAxes({ tier: ["P0", "P2"] })).map(r => r.id)).toEqual(["a", "b"]);
  });
  it("filters by author axis", () => {
    expect(applyFacets(rows, withAxes({ author: ["bot"] })).map(r => r.id)).toEqual(["b"]);
  });
  it("filters by provider axis", () => {
    const multi = [row({ id: "a", source: "github" }), row({ id: "b", source: "gitlab" })];
    expect(applyFacets(multi, withAxes({ provider: ["gitlab"] })).map(r => r.id)).toEqual(["b"]);
  });
  it("filters by labels axis", () => {
    const rs = [
      row({ id: "a", details: { labels: [{ name: "security", color: "" }] } }),
      row({ id: "b", details: { labels: [{ name: "bug", color: "" }] } }),
    ];
    expect(applyFacets(rs, withAxes({ labels: ["security"] })).map(r => r.id)).toEqual(["a"]);
  });
  it("empty axis value array = no filter", () => {
    expect(applyFacets(rows, withAxes({ scope: [] })).map(r => r.id)).toEqual(["a", "b", "c"]);
  });
  it("combines axes (AND)", () => {
    // scope=acme/web -> [a, c]; tier=P3 -> [c]; intersection -> [c]
    expect(applyFacets(rows, withAxes({ scope: ["acme/web"], tier: ["P3"] })).map(r => r.id)).toEqual(["c"]);
  });
  it("recent sort", () => {
    expect(applyFacets(rows, withAxes({}, "recent")).map(r => r.id)).toEqual(["b", "c", "a"]);
  });
});

import { renderFacetBar } from "../../src/runtime/layout/facet-bar";
import { registerFilterAxis } from "../../src/runtime/layout/facet-registry";
import type { Artifact } from "../../src/runtime/dataset/artifact";

const reviewArtifact: Artifact = { id: "review", label: "Review", group: "work", kinds: ["pull-request", "issue"] };

describe("renderFacetBar v2", () => {
  const rows: ScoredItem[] = [
    row({ id: "a", location: "acme/web", kind: "pull-request", tier: "P0", details: { author: { kind: "human" } } }),
    row({ id: "b", location: "acme/api", kind: "issue",        tier: "P2", details: { author: { kind: "bot" } } }),
  ];

  it("always shows scope, tier and a sort select", () => {
    const host = document.createElement("div");
    renderFacetBar(host, reviewArtifact, rows, emptyFacetState(), () => {});
    expect(host.querySelector("[data-axis='scope']")).not.toBeNull();
    expect(host.querySelector("[data-axis='tier']")).not.toBeNull();
    expect(host.querySelector(".facet-sort")).not.toBeNull();
  });

  it("toggling a tier chip emits the value in the axis map", () => {
    const host = document.createElement("div");
    let next = emptyFacetState();
    renderFacetBar(host, reviewArtifact, rows, emptyFacetState(), s => { next = s; });
    host.querySelector<HTMLElement>("[data-axis='tier'] [data-val='P0']")!.click();
    expect(next.axes.tier).toEqual(["P0"]);
  });

  it("changing the sort select emits the sort id", () => {
    const host = document.createElement("div");
    let next = emptyFacetState();
    renderFacetBar(host, reviewArtifact, rows, emptyFacetState(), s => { next = s; });
    const sel = host.querySelector<HTMLSelectElement>(".facet-sort")!;
    sel.value = "recent"; sel.dispatchEvent(new Event("change"));
    expect(next.sort).toBe("recent");
  });

  it("exposes a '+ Filter' control when a non-quick axis applies", () => {
    registerFilterAxis({
      id: "test-extra", label: "Extra", widget: "chips", quick: false,
      appliesTo: () => true,
      optionsFrom: () => [{ value: "x", label: "X" }],
      test: (i, sel) => sel.includes("x"),
    });
    const host = document.createElement("div");
    renderFacetBar(host, reviewArtifact, rows, emptyFacetState(), () => {});
    expect(host.querySelector("[data-add-filter]")).not.toBeNull();
  });
});
