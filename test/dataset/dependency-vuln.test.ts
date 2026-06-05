import { describe, it, expect } from "vitest";
import { severityToSignal } from "../../src/runtime/dataset/kinds/dependency-vuln";

describe("severityToSignal", () => {
  it("ranks higher severity above lower at equal cvss", () => {
    expect(severityToSignal("critical", 0)).toBeGreaterThan(severityToSignal("high", 0));
    expect(severityToSignal("high", 0)).toBeGreaterThan(severityToSignal("medium", 0));
    expect(severityToSignal("medium", 0)).toBeGreaterThan(severityToSignal("low", 0));
  });
  it("clamps to 0–100", () => {
    expect(severityToSignal("critical", 10)).toBeLessThanOrEqual(100);
    expect(severityToSignal("low", 0)).toBeGreaterThanOrEqual(0);
  });
});
