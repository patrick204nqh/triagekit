// test/core/derivation.test.ts
import { describe, it, expect } from "vitest";
import { derive } from "../../src/runtime/core/derivation";
import { emptyFacetState } from "../../src/runtime/layout/facet-bar";
import type { TriageItem } from "../../src/runtime/dataset/item";
import type { ScoreContext } from "../../src/runtime/scoring/configured";

const item = (id: string, signal: number, kind: TriageItem["kind"] = "issue"): TriageItem => ({
  id, source: "github", kind, title: id, location: "repo",
  signal, createdAt: "2026-01-01T00:00:00Z", url: "", details: {},
});

// Built-in scorer override: score = signal; thresholds put >=50 at P1, >=80 at P0.
const score: ScoreContext = {
  getModel: () => null,
  getFields: () => [],
  getThresholds: () => ({ p0: 80, p1: 50, p2: 20 }),
  override: (it) => it.signal,
};

describe("derive", () => {
  it("filters to active kinds, scores, and sorts descending", () => {
    const out = derive({
      items: [item("a", 10), item("b", 90), item("c", 50, "pull-request")],
      activeKinds: ["issue"],
      botLogins: [],
      score,
      facets: emptyFacetState(),
    });
    expect(out.scored.map(r => r.id)).toEqual(["b", "a"]); // pull-request filtered out, sorted desc
    expect(out.scored.map(r => r.score)).toEqual([90, 10]);
    expect(out.scored[0].tier).toBe("P0");
  });

  it("shown equals scored when no facets are active", () => {
    const out = derive({
      items: [item("a", 10), item("b", 90)],
      activeKinds: ["issue"],
      botLogins: [],
      score,
      facets: emptyFacetState(),
    });
    expect(out.shown.map(r => r.id)).toEqual(out.scored.map(r => r.id));
  });

  it("is pure: does not mutate the input items array", () => {
    const items = [item("a", 10), item("b", 90)];
    const before = items.map(i => i.id);
    derive({ items, activeKinds: ["issue"], botLogins: [], score, facets: emptyFacetState() });
    expect(items.map(i => i.id)).toEqual(before);
  });
});
