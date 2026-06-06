import { describe, it, expect } from "vitest";
import { tierOf } from "../../src/runtime/scoring/tier";

describe("tierOf edge cases", () => {
  it("boundary: score == threshold returns the tier", () => {
    // Default: p0=130, p1=95, p2=60
    expect(tierOf(130)).toBe("P0");
    expect(tierOf(95)).toBe("P1");
    expect(tierOf(60)).toBe("P2");
  });
  it("boundary: score below threshold moves to next lower", () => {
    expect(tierOf(129)).toBe("P1");
    expect(tierOf(94)).toBe("P2");
    expect(tierOf(59)).toBe("P3");
  });
  it("handles negative and zero scores", () => {
    expect(tierOf(-100)).toBe("P3");
    expect(tierOf(0)).toBe("P3");
  });
  it("handles very large scores", () => {
    expect(tierOf(10000)).toBe("P0");
  });
});
