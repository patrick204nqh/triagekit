import { describe, it, expect } from "vitest";
import { defaultIntent } from "../../src/runtime/handoff/intent";

describe("defaultIntent", () => {
  it("returns kind-specific outcome for known kinds", () => {
    expect(defaultIntent("dependency-vuln").outcome).toContain("dependency");
    expect(defaultIntent("code-scanning").outcome).toContain("code scanning");
    expect(defaultIntent("change-request").outcome).toContain("merge");
    expect(defaultIntent("issue").outcome).toContain("respond");
  });

  it("returns fallback for unknown kinds", () => {
    expect(defaultIntent("secret-scanning" as any).outcome).toBe("Review this item");
  });

  it("starts with empty constraints and verification", () => {
    const intent = defaultIntent("dependency-vuln");
    expect(intent.constraints).toEqual([]);
    expect(intent.verification).toEqual([]);
  });
});
