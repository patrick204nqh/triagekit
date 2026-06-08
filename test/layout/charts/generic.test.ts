// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { tierChart, ageChart, topLocationsChart } from "../../../src/runtime/layout/charts/generic";
import type { ScoredItem } from "../../../src/runtime/layout/table/kind-renderer";

const row = (over: Partial<ScoredItem>): ScoredItem => ({
  id: "x", source: "github", kind: "dependency-vuln", title: "p", location: "acme/web",
  signal: 50, createdAt: new Date(Date.now() - 100 * 86400000).toISOString(), url: "",
  details: {}, score: 100, tier: "P1", ...over,
});

describe("generic charts", () => {
  it("tier chart renders a segment per present tier", () => {
    const el = document.createElement("div");
    tierChart.render([row({ tier: "P0" }), row({ tier: "P1" })], el);
    expect(el.querySelectorAll(".tierbar span").length).toBe(2);
  });
  it("age chart renders four buckets", () => {
    const el = document.createElement("div");
    ageChart.render([row({})], el);
    expect(el.querySelectorAll(".agecol").length).toBe(4);
  });
  it("top-locations ranks repos and caps at 5", () => {
    const el = document.createElement("div");
    const rows = Array.from({ length: 7 }, (_, i) => row({ location: `acme/r${i}` }));
    topLocationsChart.render(rows, el);
    expect(el.querySelectorAll(".barrow").length).toBe(5);
  });
});
