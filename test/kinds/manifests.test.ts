import { describe, expect, it } from "vitest";
import { changeRequestKind } from "../../src/runtime/kinds/change-request";
import { codeScanningKind } from "../../src/runtime/kinds/code-scanning";
import { dependencyVulnKind } from "../../src/runtime/kinds/dependency-vuln";
import { issueKind } from "../../src/runtime/kinds/issue";

describe("ready Kind declarations", () => {
  const kinds = [
    issueKind,
    changeRequestKind,
    dependencyVulnKind,
    codeScanningKind,
  ];

  it("each owns its fields, scorer, and renderer", () => {
    for (const declaration of kinds) {
      expect(declaration.kind).toBeTruthy();
      expect(declaration.fields.length).toBeGreaterThan(0);
      expect(typeof declaration.builtInScorer).toBe("function");
      expect(typeof declaration.explainBuiltInScore).toBe("function");
      expect(declaration.renderer.kind).toBe(declaration.kind);
    }
  });

  it("declares each Kind exactly once", () => {
    expect(new Set(kinds.map((declaration) => declaration.kind)).size)
      .toBe(kinds.length);
  });
});
