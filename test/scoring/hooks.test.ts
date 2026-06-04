import { describe, it, expect } from "vitest";
import { resolveScorer } from "../../src/runtime/scoring/hooks";
import type { Alert } from "../../src/runtime/providers/registry";

const a = { severity: "low", cvss: 0 } as Alert;

describe("resolveScorer", () => {
  it("uses the default scorer when no override is injected", () => {
    expect(typeof resolveScorer(undefined)(a)).toBe("number");
  });
  it("uses an injected override when present", () => {
    const scorer = resolveScorer((alert) => 999);
    expect(scorer(a)).toBe(999);
  });
});
