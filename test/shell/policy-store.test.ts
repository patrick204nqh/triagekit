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

  it("defaults bot logins to empty and round-trips a set list", () => {
    const p = new PolicyStore();
    expect(p.getBotLogins()).toEqual([]);
    p.setBotLogins(["renovate", "internal-deploy-bot"]);
    expect(new PolicyStore().getBotLogins()).toEqual(["renovate", "internal-deploy-bot"]);
  });

  it("returns [] when stored bot logins are corrupt", () => {
    localStorage.setItem("triagekit.policy.botLogins", "{not json");
    expect(new PolicyStore().getBotLogins()).toEqual([]);
  });
});
