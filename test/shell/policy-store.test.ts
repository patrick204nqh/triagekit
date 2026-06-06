// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { PolicyStore } from "../../src/runtime/shell/policy-store";
import { DEFAULT_THRESHOLDS } from "../../src/runtime/scoring/tier";

describe("PolicyStore", () => {
  beforeEach(() => localStorage.clear());

  it("returns defaults when nothing saved", () => {
    expect(new PolicyStore().getTiers()).toEqual(DEFAULT_THRESHOLDS);
  });
  it("round-trips saved thresholds", () => {
    const s = new PolicyStore();
    s.setTiers({ p0: 200, p1: 150, p2: 100 });
    expect(new PolicyStore().getTiers()).toEqual({ p0: 200, p1: 150, p2: 100 });
  });
  it("merges partial/corrupt storage onto defaults", () => {
    localStorage.setItem("triagekit.policy.tiers", JSON.stringify({ p1: 80 }));
    expect(new PolicyStore().getTiers()).toEqual({ ...DEFAULT_THRESHOLDS, p1: 80 });
    localStorage.setItem("triagekit.policy.tiers", "not json");
    expect(new PolicyStore().getTiers()).toEqual(DEFAULT_THRESHOLDS);
  });

  it("stores and retrieves a score model per kind; null when absent or corrupt", () => {
    const p = new PolicyStore();
    expect(p.getScoreModel("dependency-vuln")).toBeNull();
    const model = {
      kind: "dependency-vuln" as const, scale: 1, formula: "cvss * 100",
      signals: { cvss: { from: "cvss", transform: { type: "linear" as const, in: [0, 10] as [number, number] } } },
      tiers: [{ name: "P0", min: 80 }, { name: "P3", min: 0 }],
    };
    p.setScoreModel("dependency-vuln", model);
    expect(new PolicyStore().getScoreModel("dependency-vuln")).toEqual(model);
    localStorage.setItem("triagekit.policy.score.dependency-vuln", "{bad");
    expect(new PolicyStore().getScoreModel("dependency-vuln")).toBeNull();
    p.clearScoreModel("dependency-vuln");
    expect(new PolicyStore().getScoreModel("dependency-vuln")).toBeNull();
  });
});
