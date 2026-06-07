import { describe, it, expect } from "vitest";
import { previewRerank } from "../../src/runtime/scoring/preview";
import type { ScoreModel } from "../../src/runtime/scoring/score-model";
import type { TriageItem } from "../../src/runtime/dataset/item";

const model: ScoreModel = {
  kind: "dependency-vuln", scale: 100,
  signals: { cvss: { from: "cvss", transform: { type: "linear", in: [0, 10] } } },
  formula: "cvss * 1",
  tiers: [{ name: "P0", min: 80 }, { name: "P1", min: 50 }, { name: "P2", min: 25 }, { name: "P3", min: 0 }],
};
const item = (id: string, cvss: number): TriageItem => ({
  id, source: "github", kind: "dependency-vuln", title: `pkg-${id}`, location: "acme/web",
  signal: 0, createdAt: "2026-01-01T00:00:00Z", url: "", details: { cvss },
});

describe("previewRerank", () => {
  it("scores rows by the model, sorts desc, and limits to topN", () => {
    const rows = [item("a", 1), item("b", 10), item("c", 5)];
    const out = previewRerank(model, rows, 2);
    expect(out.map(r => r.item.id)).toEqual(["b", "c"]);   // 100, 50 (a=10 dropped by topN)
    expect(out[0]).toMatchObject({ score: 100, tier: "P0" });
    expect(out[1]).toMatchObject({ score: 50, tier: "P1" });
  });
  it("reflects the draft model (a cvss-weighted model ranks the high-cvss item first)", () => {
    const rows = [item("low", 2), item("high", 9)];
    expect(previewRerank(model, rows, 5).map(r => r.item.id)).toEqual(["high", "low"]);
  });
  it("returns at most topN rows", () => {
    const rows = [item("a", 1), item("b", 2), item("c", 3)];
    expect(previewRerank(model, rows, 1)).toHaveLength(1);
  });
  it("drops rows whose eval throws without failing the batch", () => {
    const broken: ScoreModel = { ...model, formula: "cvss +" };   // unparseable → every row throws
    expect(previewRerank(broken, [item("a", 1)], 5)).toEqual([]);
  });
});
