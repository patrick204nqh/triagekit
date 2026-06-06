import { describe, it, expect } from "vitest";
import { applyTransform } from "../../src/runtime/scoring/signal-transform";

describe("applyTransform", () => {
  it("linear normalizes and clamps to 0..1", () => {
    expect(applyTransform(5, { type: "linear", in: [0, 10] })).toBe(0.5);
    expect(applyTransform(-3, { type: "linear", in: [0, 10] })).toBe(0);
    expect(applyTransform(99, { type: "linear", in: [0, 10] })).toBe(1);
    expect(applyTransform("bad", { type: "linear", in: [0, 10] })).toBe(0);
  });
  it("bool maps truthiness to 1/0", () => {
    expect(applyTransform(true, { type: "bool" })).toBe(1);
    expect(applyTransform(false, { type: "bool" })).toBe(0);
  });
  it("enum looks up a value, unknown -> 0", () => {
    const tf = { type: "enum" as const, map: { critical: 1, high: 0.7 } };
    expect(applyTransform("critical", tf)).toBe(1);
    expect(applyTransform("low", tf)).toBe(0);
  });
  it("enum clamps out-of-range map values to 0..1", () => {
    expect(applyTransform("critical", { type: "enum" as const, map: { critical: 1.5 } })).toBe(1);
    expect(applyTransform("critical", { type: "enum" as const, map: { critical: -0.5 } })).toBe(0);
  });
  it("ageDays decays toward 1 with age, 0.5 at the half-life", () => {
    const now = Date.parse("2026-02-01T00:00:00Z");
    const thirtyDaysAgo = "2026-01-02T00:00:00Z";   // 30 days before now
    expect(applyTransform(thirtyDaysAgo, { type: "ageDays", halfLife: 30 }, now)).toBeCloseTo(0.5, 5);
    expect(applyTransform("2026-02-01T00:00:00Z", { type: "ageDays", halfLife: 30 }, now)).toBe(0);
    expect(applyTransform("not-a-date", { type: "ageDays", halfLife: 30 }, now)).toBe(0);
    expect(applyTransform(null, { type: "ageDays", halfLife: 30 }, now)).toBe(0);
    expect(applyTransform(undefined, { type: "ageDays", halfLife: 30 }, now)).toBe(0);
  });
});
