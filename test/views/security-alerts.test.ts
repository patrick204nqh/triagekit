// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderTriageList, type ScoredItem } from "../../src/runtime/layout/triage-table";
import "../../src/runtime/views/security-alerts/view";
import { getFilterAxis, getSortKey } from "../../src/runtime/layout/facet-registry";

it("registers vuln severity + fix-available axes and a severity sort", () => {
  expect(getFilterAxis("severity")).toBeDefined();
  expect(getFilterAxis("fix-available")).toBeDefined();
  expect(getSortKey("severity")).toBeDefined();
});

describe("vuln detail in shared panel", () => {
  it("renders severity + fix into the drawer on row click", () => {
    const r = {
      id: "v1", source: "github", kind: "dependency-vuln", title: "log4j", location: "acme/web",
      signal: 90, createdAt: "2026-01-01T00:00:00Z", url: "https://ghsa",
      details: { package: "log4j", severity: "critical", cvss: 9.8, scope: "runtime", fixAvailable: true, fixVersion: "2.17.1" },
      score: 140, tier: "P0",
    } as unknown as ScoredItem;
    const root = document.createElement("div");
    renderTriageList(root, [r], []);
    (root.querySelector(".alert-row") as HTMLElement).click();
    const txt = root.querySelector(".drawer")!.textContent!;
    expect(txt).toContain("critical");
    expect(txt).toContain("2.17.1");
  });
});
