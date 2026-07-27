// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { dependencyVulnCharts } from "../../../src/runtime/views/code-security/view";

describe("dependency-vuln charts", () => {
  it("declares fixable and scope charts for the kind", () => {
    const ids = dependencyVulnCharts.map((chart) => chart.id);
    expect(ids).toContain("dv-fixable"); expect(ids).toContain("dv-scope");
  });
});
