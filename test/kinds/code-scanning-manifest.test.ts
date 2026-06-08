// test/kinds/code-scanning-manifest.test.ts
import { describe, it, expect } from "vitest";
import { registerKinds } from "../../src/runtime/core/register-kinds";
import { codeScanningKind } from "../../src/runtime/kinds/code-scanning";
import { resolveScorer } from "../../src/runtime/scoring/registry";
import { getFilterAxis } from "../../src/runtime/layout/toolbar/axis-registry";

describe("codeScanningKind manifest", () => {
  it("registers scorer + filter axes via registerKinds", () => {
    registerKinds([codeScanningKind]);
    expect(typeof resolveScorer("code-scanning")).toBe("function");
    expect(getFilterAxis("cs-severity")).toBeDefined();
    expect(getFilterAxis("cs-tool")).toBeDefined();
    expect(getFilterAxis("cs-state")).toBeDefined();
  });
});
