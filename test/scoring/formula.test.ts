import { describe, it, expect } from "vitest";
import { parseFormula, evalFormula, formulaVars, FormulaError } from "../../src/runtime/scoring/formula";

const ev = (src: string, scope: Record<string, number>) => evalFormula(parseFormula(src), scope);

describe("formula parser/evaluator", () => {
  it("respects precedence and parentheses", () => {
    expect(ev("1 + 2 * 3", {})).toBe(7);
    expect(ev("(1 + 2) * 3", {})).toBe(9);
  });
  it("evaluates identifiers from scope", () => {
    expect(ev("severity * 0.45 + exploit * 0.3", { severity: 1, exploit: 1 })).toBeCloseTo(0.75, 5);
  });
  it("supports unary minus and division", () => {
    expect(ev("-severity / 2", { severity: 8 })).toBe(-4);
  });
  it("supports min/max/clamp", () => {
    expect(ev("max(a, b)", { a: 2, b: 5 })).toBe(5);
    expect(ev("min(a, b)", { a: 2, b: 5 })).toBe(2);
    expect(ev("clamp(x, 0, 10)", { x: 99 })).toBe(10);
  });
  it("formulaVars lists referenced identifiers", () => {
    expect(formulaVars(parseFormula("a + b * a")).sort()).toEqual(["a", "b"]);
  });
  it("throws FormulaError on unknown identifier at eval", () => {
    expect(() => ev("ghost + 1", {})).toThrow(FormulaError);
  });
  it("throws FormulaError on unknown function", () => {
    expect(() => parseFormula("danger(a)")).toThrow(FormulaError);
  });
  it("throws FormulaError on malformed input", () => {
    expect(() => parseFormula("1 + ")).toThrow(FormulaError);
    expect(() => parseFormula("(1 + 2")).toThrow(FormulaError);
    expect(() => parseFormula("1 2")).toThrow(FormulaError);
  });
  it("throws FormulaError for prototype-chain names not in scope (e.g. toString)", () => {
    expect(() => ev("toString + 1", {})).toThrow(FormulaError);
  });
  it("throws FormulaError when clamp receives wrong arity at eval", () => {
    expect(() => ev("clamp(x, 0)", { x: 5 })).toThrow(FormulaError);
  });
});
