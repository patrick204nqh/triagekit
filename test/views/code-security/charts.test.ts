// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import "../../../src/runtime/views/code-security/view";   // registers the charts
import { chartsFor } from "../../../src/runtime/layout/charts/registry";

describe("dependency-vuln charts", () => {
  it("registers fixable + scope charts for the kind", () => {
    const ids = chartsFor(["dependency-vuln"]).map(c => c.id);
    expect(ids).toContain("dv-fixable"); expect(ids).toContain("dv-scope");
  });
});
