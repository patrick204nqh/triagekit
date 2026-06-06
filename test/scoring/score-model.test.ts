import { describe, it, expect } from "vitest";
import {
  evalScoreModel, tierFromBands, validateModel, type ScoreModel,
} from "../../src/runtime/scoring/score-model";
import type { FieldDef } from "../../src/runtime/scoring/field-catalog";
import type { TriageItem } from "../../src/runtime/dataset/item";

const model: ScoreModel = {
  kind: "dependency-vuln",
  signals: {
    severity: { from: "severity", transform: { type: "enum", map: { critical: 1, high: 0.7, medium: 0.4, low: 0.1 } } },
    cvss: { from: "cvss", transform: { type: "linear", in: [0, 10] } },
    fix: { from: "fixAvailable", transform: { type: "bool" } },
  },
  formula: "(severity * 0.6 + cvss * 0.3 + fix * 0.1) * 100",
  scale: 1,
  tiers: [{ name: "P0", min: 80 }, { name: "P1", min: 60 }, { name: "P2", min: 40 }, { name: "P3", min: 0 }],
};

const item: TriageItem = {
  id: "x", source: "github", kind: "dependency-vuln", title: "lodash", location: "acme/web",
  signal: 0, createdAt: "2026-01-01T00:00:00Z", url: "",
  details: { severity: "critical", cvss: 10, fixAvailable: true },
};

const fields: FieldDef[] = [
  { name: "severity", type: "enum", values: ["critical", "high", "medium", "low"] },
  { name: "cvss", type: "number", range: [0, 10] },
  { name: "fixAvailable", type: "bool" },
  { name: "signal", type: "number" }, { name: "createdAt", type: "date" },
];

describe("evalScoreModel", () => {
  it("computes signals, applies the formula, rounds, and scales", () => {
    // severity=1*0.6 + cvss=1*0.3 + fix=1*0.1 = 1.0 -> *100 -> 100
    expect(evalScoreModel(model, item)).toBe(100);
  });
  it("reads item-level fields (e.g. signal) as well as details fields", () => {
    const m: ScoreModel = { ...model, signals: { s: { from: "signal", transform: { type: "linear", in: [0, 100] } } }, formula: "s * 100" };
    expect(evalScoreModel(m, { ...item, signal: 50 })).toBe(50);
  });
  it("returns 0 for signals when details is null, without throwing", () => {
    // details typed as unknown; cast lets us test the null-guard in readField
    expect(evalScoreModel(model, { ...item, details: null } as TriageItem)).toBe(0);
  });
  it("applies scale to the formula result before rounding", () => {
    const m: ScoreModel = { ...model, formula: "severity", scale: 50 };
    expect(evalScoreModel(m, item)).toBe(50); // severity=1 * scale=50
  });
});

describe("tierFromBands", () => {
  it("returns the highest band whose min is satisfied", () => {
    expect(tierFromBands(100, model.tiers)).toBe("P0");
    expect(tierFromBands(65, model.tiers)).toBe("P1");
    expect(tierFromBands(0, model.tiers)).toBe("P3");
  });
  it("falls back to the lowest band when score is below every minimum", () => {
    expect(tierFromBands(-5, [{ name: "P0", min: 80 }, { name: "P3", min: 0 }])).toBe("P3");
  });
});

describe("validateModel", () => {
  it("accepts a well-formed model", () => {
    expect(validateModel(model, fields)).toEqual([]);
  });
  it("flags a signal referencing an unknown field", () => {
    const bad: ScoreModel = { ...model, signals: { ...model.signals, ghost: { from: "nope", transform: { type: "bool" } } }, formula: "ghost" };
    expect(validateModel(bad, fields).some(e => e.includes("unknown field"))).toBe(true);
  });
  it("flags a formula referencing an undeclared signal", () => {
    const bad: ScoreModel = { ...model, formula: "severity + mystery" };
    expect(validateModel(bad, fields).some(e => e.includes("unknown signal"))).toBe(true);
  });
  it("flags non-decreasing tier cutoffs", () => {
    const bad: ScoreModel = { ...model, tiers: [{ name: "P0", min: 50 }, { name: "P1", min: 60 }] };
    expect(validateModel(bad, fields).some(e => e.includes("decrease"))).toBe(true);
  });
  it("flags a prototype-named signal (e.g. constructor) as unknown", () => {
    const bad: ScoreModel = { ...model, formula: "constructor + severity" };
    expect(validateModel(bad, fields).some(e => e.includes("unknown signal"))).toBe(true);
  });
  it("flags clamp with the wrong number of arguments", () => {
    const bad: ScoreModel = { ...model, formula: "clamp(cvss, 0)" };
    expect(validateModel(bad, fields).some(e => e.includes("clamp"))).toBe(true);
  });
});
