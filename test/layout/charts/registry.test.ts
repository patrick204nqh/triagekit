import { describe, it, expect } from "vitest";
import { registerChart, chartsFor } from "../../../src/runtime/layout/charts/registry";

registerChart({ id: "g", title: "G", kinds: "*", render: () => {} });
registerChart({ id: "dv", title: "DV", kinds: ["dependency-vuln"], render: () => {} });
registerChart({ id: "infra", title: "I", kinds: ["cloud-misconfig"], render: () => {} });

describe("chartsFor", () => {
  it("returns generic + charts matching the kinds", () => {
    const ids = chartsFor(["dependency-vuln"]).map(c => c.id);
    expect(ids).toContain("g"); expect(ids).toContain("dv"); expect(ids).not.toContain("infra");
  });
});
