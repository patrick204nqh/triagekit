import { describe, it, expect } from "vitest";
import { explainScoreModel, evalScoreModel, type ScoreModel } from "../../src/runtime/scoring/score-model";
import type { TriageItem } from "../../src/runtime/dataset/item";

const model: ScoreModel = {
  kind: "dependency-vuln", scale: 100,
  signals: {
    severity: { from: "severity", transform: { type: "enum", map: { critical: 1, high: 0.7 } } },
    cvss: { from: "cvss", transform: { type: "linear", in: [0, 10] } },
  },
  formula: "severity * 0.5 + cvss * 0.5",
  tiers: [{ name: "P0", min: 80 }, { name: "P3", min: 0 }],
};
const item: TriageItem = {
  id: "x", source: "github", kind: "dependency-vuln", title: "lodash", location: "acme/web",
  signal: 0, createdAt: "2026-01-01T00:00:00Z", url: "",
  details: { severity: "critical", cvss: 10 },
};

describe("explainScoreModel", () => {
  it("returns per-signal from/raw/normalized value and the score", () => {
    const ex = explainScoreModel(model, item);
    expect(ex.signals.severity).toEqual({ from: "severity", raw: "critical", value: 1 });
    expect(ex.signals.cvss).toEqual({ from: "cvss", raw: 10, value: 1 });
    expect(ex.score).toBe(100);   // (1*0.5 + 1*0.5) * 100
  });
  it("evalScoreModel returns the same score as explainScoreModel", () => {
    expect(evalScoreModel(model, item)).toBe(explainScoreModel(model, item).score);
  });
});
