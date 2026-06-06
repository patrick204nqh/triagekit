import { describe, it, expect } from "vitest";
import { weightsToFormula, formulaToWeights } from "../../src/runtime/scoring/weights";

describe("weightsToFormula", () => {
  it("builds a canonical weighted sum in key order", () => {
    expect(weightsToFormula({ a: 0.6, b: 0.4 })).toBe("a * 0.6 + b * 0.4");
  });
  it("returns '0' for no signals", () => {
    expect(weightsToFormula({})).toBe("0");
  });
});

describe("formulaToWeights", () => {
  it("parses a canonical weighted sum (either operand order)", () => {
    expect(formulaToWeights("a * 0.6 + 0.4 * b", ["a", "b"])).toEqual({ a: 0.6, b: 0.4 });
  });
  it("round-trips weightsToFormula", () => {
    const w = { sev: 0.5, cvss: 0.5 };
    expect(formulaToWeights(weightsToFormula(w), ["sev", "cvss"])).toEqual(w);
  });
  it("returns null for a non-weighted-sum formula (scale, parens, funcs)", () => {
    expect(formulaToWeights("(a * 0.6 + b * 0.4) * 100", ["a", "b"])).toBeNull();
    expect(formulaToWeights("clamp(a, 0, 1)", ["a"])).toBeNull();
    expect(formulaToWeights("a - b", ["a", "b"])).toBeNull();
  });
  it("returns null when terms don't cover exactly the signal set", () => {
    expect(formulaToWeights("a * 0.6", ["a", "b"])).toBeNull();          // missing b
    expect(formulaToWeights("a * 0.6 + c * 0.4", ["a", "b"])).toBeNull(); // extra c
    expect(formulaToWeights("a * 0.6 + a * 0.4", ["a"])).toBeNull();      // duplicate a
  });
  it("returns null for an unparseable formula", () => {
    expect(formulaToWeights("a * ", ["a"])).toBeNull();
  });
});
