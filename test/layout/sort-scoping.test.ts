import { describe, it, expect } from "vitest";
// Importing the views registers their sort keys as module side-effects.
import { runtimeCatalog } from "../../src/runtime/catalog/built-in";
import type { AxisCtx } from "../../src/runtime/layout/toolbar/axis-registry";

// Kind-specific severity sort keys must be scoped via appliesTo, otherwise they
// leak onto every tab — and since two of them share the label "Severity", an
// unscoped pair renders a confusing duplicate in the sort popover.
const ctx = (kinds: string[]): AxisCtx =>
  ({ artifact: { id: "x", label: "X", group: "finding", kinds } } as unknown as AxisCtx);

describe("severity sort keys are scoped to their kind", () => {
  it("cs-severity applies only to the code-scanning tab", () => {
    const k = runtimeCatalog.sort("cs-severity")!;
    expect(k.appliesTo).toBeTypeOf("function");
    expect(k.appliesTo!(ctx(["code-scanning"]))).toBe(true);
    expect(k.appliesTo!(ctx(["dependency-vuln"]))).toBe(false);
    expect(k.appliesTo!(ctx(["issue"]))).toBe(false);
  });

  it("dependency-vuln severity applies only to the dependencies tab", () => {
    const k = runtimeCatalog.sort("severity")!;
    expect(k.appliesTo).toBeTypeOf("function");
    expect(k.appliesTo!(ctx(["dependency-vuln"]))).toBe(true);
    expect(k.appliesTo!(ctx(["code-scanning"]))).toBe(false);
    expect(k.appliesTo!(ctx(["issue"]))).toBe(false);
  });

  it("universal sort keys stay unscoped (apply everywhere)", () => {
    expect(runtimeCatalog.sort("priority")!.appliesTo).toBeUndefined();
    expect(runtimeCatalog.sort("recent")!.appliesTo).toBeUndefined();
  });
});
