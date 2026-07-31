// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderTriageList } from "../../src/runtime/layout/table/detail-panel";
import type { ScoredItem } from "../../src/runtime/layout/table/kind-renderer";
import { dependencyVulnKind } from "../../src/runtime/kinds/dependency-vuln";

it("declares vuln severity and fix-available axes and a severity sort", () => {
  expect(dependencyVulnKind.filters.map((axis) => axis.id))
    .toEqual(expect.arrayContaining(["severity", "fix-available"]));
  expect(dependencyVulnKind.sorts.map((sort) => sort.id))
    .toContain("severity");
});

describe("vuln detail in shared panel", () => {
  it("renders severity + fix into the drawer on row click", () => {
    const r = {
      id: "v1", provider: "github", providerRef: {}, kind: "dependency-vuln", title: "log4j", location: "acme/web",
      signal: 90, createdAt: "2026-01-01T00:00:00Z", url: "https://ghsa",
      details: { package: "log4j", severity: "critical", cvss: 9.8, scope: "runtime", fixAvailable: true, fixVersion: "2.17.1" },
      score: 140, tier: "P0",
    } as unknown as ScoredItem;
    const root = document.createElement("div");
    renderTriageList(root, [r], []);
    (root.querySelector(".alert-row") as HTMLElement).click();
    // shared detailHeadHtml: package in <h3> + tier chip, provider icon in the ref row
    const drawer = root.querySelector<HTMLElement>(".drawer")!;
    const titleId = drawer.getAttribute("aria-labelledby")!;
    const heading = drawer.querySelector<HTMLElement>(`#${titleId}`)!;
    expect(heading.textContent).toBe("log4j P0");
    expect(heading.querySelector(".tier-P0")?.textContent).toBe("P0");
    expect(root.querySelector(".drawer-head .prov-icon")).toBeTruthy();
    const txt = root.querySelector(".drawer-content")!.textContent!;
    expect(txt).toContain("critical");   // <dl> body preserved
    expect(txt).toContain("2.17.1");
    expect(root.querySelector(".drawer-foot [data-action='open']")).toBeTruthy();
  });
});
