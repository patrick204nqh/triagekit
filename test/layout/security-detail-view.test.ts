// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { dependencyVulnDetailView } from "../../src/runtime/views/code-security/view";
import type { ScoredItem } from "../../src/runtime/layout/table/kind-renderer";

function vuln(): ScoredItem {
  return {
    id: "github:dv:1", source: "github", kind: "dependency-vuln",
    title: "axios", url: "https://github.com/advisories/GHSA-xxxx",
    createdAt: new Date().toISOString(), score: 80, tier: "P0", location: "x/y",
    details: { package: "axios", severity: "high", cvss: 7.5, scope: "runtime", fixAvailable: true, fixVersion: "1.7.4" },
  } as unknown as ScoredItem;
}

describe("dependencyVulnDetailView", () => {
  it("header uses the package + provider, no ref number", () => {
    const v = dependencyVulnDetailView(vuln());
    expect(v.header.title).toBe("axios");
    expect(v.header.provider).toBe("github");
    expect(v.header.ref).toBeUndefined();
  });

  it("body renders the severity/fix dl; footer opens the advisory", () => {
    const v = dependencyVulnDetailView(vuln());
    const body = document.createElement("div"); v.body(body);
    expect(body.querySelector("dl")).toBeTruthy();
    expect(body.innerHTML).toContain("1.7.4");
    const foot = document.createElement("div"); v.actions!(foot);
    const a = foot.querySelector<HTMLAnchorElement>("a");
    expect(a?.getAttribute("href")).toContain("advisories");
    expect(a?.textContent).toContain("Open");
  });
});
