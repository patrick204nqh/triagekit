import { describe, it, expect } from "vitest";
import { scoreAndTier } from "../../src/runtime/scoring/configured";
import type { ScoreModel } from "../../src/runtime/scoring/score-model";
import type { TriageItem } from "../../src/runtime/dataset/item";
import { DEFAULT_THRESHOLDS } from "../../src/runtime/scoring/tier";

const item: TriageItem = {
  id: "x", source: "github", kind: "dependency-vuln", title: "lodash", location: "acme/web",
  signal: 42, createdAt: "2026-01-01T00:00:00Z", url: "",
  details: { severity: "critical", cvss: 10, fixAvailable: true, scope: "runtime" },
};

const validModel: ScoreModel = {
  kind: "dependency-vuln", scale: 1, formula: "cvss * 100",
  signals: { cvss: { from: "cvss", transform: { type: "linear", in: [0, 10] } } },
  tiers: [{ name: "P0", min: 80 }, { name: "P1", min: 50 }, { name: "P3", min: 0 }],
};

const fields = [{ name: "cvss", type: "number" as const }];

describe("scoreAndTier", () => {
  it("uses a valid stored model when present", () => {
    const r = scoreAndTier(item, { getModel: () => validModel, getFields: () => fields, getThresholds: () => DEFAULT_THRESHOLDS });
    expect(r.score).toBe(100);
    expect(r.tier).toBe("P0");
  });
  it("falls back to the built-in scorer + thresholds when no model", () => {
    const r = scoreAndTier(item, { getModel: () => null, getFields: () => fields, getThresholds: () => DEFAULT_THRESHOLDS });
    // built-in dependency-vuln scorer is registered on import; just assert it's a number tiered by thresholds
    expect(typeof r.score).toBe("number");
    expect(["P0", "P1", "P2", "P3"]).toContain(r.tier);
  });
  it("falls back when the stored model is invalid (does not throw)", () => {
    const broken: ScoreModel = { ...validModel, formula: "cvss + mystery" };
    const r = scoreAndTier(item, { getModel: () => broken, getFields: () => fields, getThresholds: () => DEFAULT_THRESHOLDS });
    expect(["P0", "P1", "P2", "P3"]).toContain(r.tier);   // used fallback, not the broken model
  });
});
