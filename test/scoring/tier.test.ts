import { describe, it, expect } from "vitest";
import { tierOf, DEFAULT_THRESHOLDS, type TierThresholds } from "../../src/runtime/scoring/tier";

describe("tierOf", () => {
  it("uses default thresholds (130/95/60) when none passed", () => {
    expect(tierOf(140)).toBe("P0");
    expect(tierOf(100)).toBe("P1");
    expect(tierOf(70)).toBe("P2");
    expect(tierOf(10)).toBe("P3");
  });
  it("honors custom thresholds", () => {
    const t: TierThresholds = { p0: 200, p1: 150, p2: 100 };
    expect(tierOf(90, t)).toBe("P3");
    expect(tierOf(210, t)).toBe("P0");
    expect(tierOf(160, t)).toBe("P1");
    expect(tierOf(120, t)).toBe("P2");
  });
  it("exposes DEFAULT_THRESHOLDS = 130/95/60", () => {
    expect(DEFAULT_THRESHOLDS).toEqual({ p0: 130, p1: 95, p2: 60 });
  });
});
