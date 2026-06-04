import { describe, it, expect } from "vitest";
import { defaultPriorityScore, tierOf } from "../../../src/runtime/views/security-alerts/score";
import type { Alert } from "../../../src/runtime/providers/registry";

const base: Alert = {
  repo: "web-app", package: "lodash", severity: "critical", cvss: 9.8,
  fixAvailable: true, scope: "runtime", createdAt: new Date().toISOString(),
  ghsaUrl: "", raw: {},
};

describe("scoring", () => {
  it("scores critical+fix+runtime high and tiers it P0", () => {
    const s = defaultPriorityScore(base);
    expect(s).toBeGreaterThanOrEqual(130);
    expect(tierOf(s)).toBe("P0");
  });
  it("penalizes dev-scope dependencies", () => {
    const dev = defaultPriorityScore({ ...base, scope: "development" });
    expect(dev).toBeLessThan(defaultPriorityScore(base));
  });
});
