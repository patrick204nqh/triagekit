import { describe, it, expect } from "vitest";
import type { TriageItem } from "../../src/runtime/dataset/item";
import type { ReadyKindDeclaration } from "../../src/runtime/catalog/types";
import { dependencyVulnKind } from "../../src/runtime/kinds/dependency-vuln";
import { codeScanningKind } from "../../src/runtime/kinds/code-scanning";
import { changeRequestKind } from "../../src/runtime/kinds/change-request";
import { issueKind } from "../../src/runtime/kinds/issue";

function projectTarget(kind: any): (item: TriageItem) => any {
  const fn = (kind as ReadyKindDeclaration).projectTarget;
  expect(fn).toBeDefined();
  return fn!;
}

const baseItem: TriageItem = {
  id: "gh:1", provider: "github", providerRef: { id: 1 },
  kind: "dependency-vuln", title: "test", location: "acme/app",
  signal: 80, createdAt: "2026-07-26T00:00:00.000Z",
  url: "https://github.com/acme/app/security/1",
  details: {},
};

describe("kind projection", () => {
  for (const k of [dependencyVulnKind, codeScanningKind, changeRequestKind, issueKind]) {
    it(`${k.kind} has a projectTarget function`, () => {
      projectTarget(k);
    });
  }

  it("dependency-vuln projectTarget returns expected shape", () => {
    const fn = projectTarget(dependencyVulnKind);
    const item = { ...baseItem, details: { package: "lodash", severity: "critical", cvss: 9.8 } };
    const result = fn(item);
    expect(result.title).toBe("test");
    expect(result.providerReference).toHaveProperty("package");
    expect(result.details).toHaveProperty("severity", "critical");
  });

  it("code-scanning projectTarget includes ruleId in providerReference", () => {
    const fn = projectTarget(codeScanningKind);
    const item = { ...baseItem, kind: "code-scanning", details: { ruleId: "js/injection", tool: "CodeQL", securitySeverity: "high" } };
    const result = fn(item);
    expect(result.providerReference).toHaveProperty("ruleId", "js/injection");
  });

  it("change-request projectTarget exposes number and state", () => {
    const fn = projectTarget(changeRequestKind);
    const item = { ...baseItem, kind: "change-request", details: { number: 42, state: "open" } };
    const result = fn(item);
    expect(result.providerReference).toHaveProperty("number", 42);
    expect(result.providerReference).toHaveProperty("state", "open");
  });

  it("handles missing details gracefully", () => {
    const fn = projectTarget(dependencyVulnKind);
    const item = { ...baseItem, details: null as any };
    const result = fn(item);
    expect(result.title).toBe("test");
    expect(result.providerReference).toHaveProperty("package");
  });
});
