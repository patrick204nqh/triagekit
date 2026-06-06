// @vitest-environment jsdom
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

import { renderFacetBar } from "../../src/runtime/layout/facet-bar";
import type { Artifact } from "../../src/runtime/dataset/artifact";

const reviewArtifact: Artifact = { id: "review", label: "Review", group: "work", kinds: ["pull-request", "issue"] };
const vulnArtifact: Artifact = { id: "vulnerabilities", label: "Vulnerabilities", group: "findings", kinds: ["dependency-vuln", "code-scanning"] };

describe("renderFacetBar", () => {
  const rows: ScoredItem[] = [
    row({ id: "a", location: "acme/web", kind: "pull-request", tier: "P0", details: { author: { kind: "human" } } }),
    row({ id: "b", location: "acme/api", kind: "issue",        tier: "P2", details: { author: { kind: "bot" } } }),
  ];

  it("always shows tier and sort axes", () => {
    const host = document.createElement("div");
    renderFacetBar(host, reviewArtifact, rows, emptyFacetState(), () => {});
    expect(host.querySelector("[data-axis='tier']")).not.toBeNull();
    expect(host.querySelector("[data-axis='sort']")).not.toBeNull();
  });

  it("shows scope axis only with >=2 distinct locations", () => {
    const one = document.createElement("div");
    renderFacetBar(one, reviewArtifact, [rows[0]], emptyFacetState(), () => {});
    expect(one.querySelector("[data-axis='scope']")).toBeNull();
    const two = document.createElement("div");
    renderFacetBar(two, reviewArtifact, rows, emptyFacetState(), () => {});
    expect(two.querySelector("[data-axis='scope']")).not.toBeNull();
  });

  it("shows kind axis only when artifact bundles >=2 kinds", () => {
    const multi = document.createElement("div");
    renderFacetBar(multi, vulnArtifact, [row({ kind: "dependency-vuln", details: {} })], emptyFacetState(), () => {});
    expect(multi.querySelector("[data-axis='kind']")).not.toBeNull();
    const single = document.createElement("div");
    const single1 = { id: "t", label: "Tasks", group: "work", kinds: ["work-item"] } as Artifact;
    renderFacetBar(single, single1, [row({ kind: "work-item", details: {} })], emptyFacetState(), () => {});
    expect(single.querySelector("[data-axis='kind']")).toBeNull();
  });

  it("shows author axis only when all rows carry author.kind", () => {
    const withAuthor = document.createElement("div");
    renderFacetBar(withAuthor, reviewArtifact, rows, emptyFacetState(), () => {});
    expect(withAuthor.querySelector("[data-axis='author']")).not.toBeNull();
    const noAuthor = document.createElement("div");
    renderFacetBar(noAuthor, vulnArtifact, [row({ kind: "dependency-vuln", details: {} })], emptyFacetState(), () => {});
    expect(noAuthor.querySelector("[data-axis='author']")).toBeNull();
  });

  it("clicking a sort button calls onChange with the next state", () => {
    const host = document.createElement("div");
    let next = emptyFacetState();
    renderFacetBar(host, reviewArtifact, rows, emptyFacetState(), s => { next = s; });
    host.querySelector<HTMLElement>("[data-sort='recent']")!.click();
    expect(next.sort).toBe("recent");
  });

  it("toggling a tier chip adds/removes from the set", () => {
    const host = document.createElement("div");
    let next = emptyFacetState();
    renderFacetBar(host, reviewArtifact, rows, emptyFacetState(), s => { next = s; });
    host.querySelector<HTMLElement>("[data-tier='P0']")!.click();
    expect([...next.tiers]).toEqual(["P0"]);
  });
});
