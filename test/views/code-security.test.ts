// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderTriageList } from "../../src/runtime/layout/table/detail-panel";
import type { ScoredItem } from "../../src/runtime/layout/table/kind-renderer";
import "../../src/runtime/views/code-security/view";   // registers the severity sort key + view + charts
import { registerKinds } from "../../src/runtime/core/register-kinds";
import { dependencyVulnKind } from "../../src/runtime/kinds/dependency-vuln";
registerKinds([dependencyVulnKind]);   // registers vuln renderer + severity/fix axes
import { getFilterAxis, getSortKey } from "../../src/runtime/layout/toolbar/axis-registry";

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
    const html = root.querySelector(".drawer")!.innerHTML;
    // shared detailHeadHtml: package in <h3> + tier chip, provider icon in the ref row
    expect(html).toContain('<h3>log4j <span class="tier tier-P0">P0</span></h3>');
    expect(root.querySelector(".drawer-head .prov-icon")).toBeTruthy();
    const txt = root.querySelector(".drawer-content")!.textContent!;
    expect(txt).toContain("critical");   // <dl> body preserved
    expect(txt).toContain("2.17.1");
    expect(root.querySelector(".drawer-foot [data-action='open']")).toBeTruthy();
  });
});
