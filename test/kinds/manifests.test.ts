import { describe, it, expect } from "vitest";
import { issueKind } from "../../src/runtime/kinds/issue";
import { pullRequestKind } from "../../src/runtime/kinds/pull-request";
import { dependencyVulnKind } from "../../src/runtime/kinds/dependency-vuln";
import { registerKinds } from "../../src/runtime/core/register-kinds";

describe("live kind manifests", () => {
  it("each declares its kind, fields, scorer, and renderer", () => {
    for (const m of [issueKind, pullRequestKind, dependencyVulnKind]) {
      expect(m.kind).toBeTruthy();
      expect(m.fields.length).toBeGreaterThan(0);
      expect(typeof m.builtInScorer).toBe("function");
      expect(m.renderer.kind).toBe(m.kind);
    }
  });
  it("registerKinds accepts all three without throwing", () => {
    expect(() => registerKinds([issueKind, pullRequestKind, dependencyVulnKind])).not.toThrow();
  });
});
