import { describe, expect, it } from "vitest";
import { runtimeDefaults } from "../../src/runtime/catalog/defaults";
import { createRuntimeCatalog } from "../../src/runtime/catalog/runtime-catalog";
import { changeRequestKind } from "../../src/runtime/kinds/change-request";
import { codeScanningKind } from "../../src/runtime/kinds/code-scanning";
import { dependencyVulnKind } from "../../src/runtime/kinds/dependency-vuln";
import { issueKind } from "../../src/runtime/kinds/issue";
import { upcomingKinds } from "../../src/runtime/kinds/upcoming";

describe("Kind declarations", () => {
  it("own their complete provider-neutral runtime behavior", () => {
    const catalog = createRuntimeCatalog({
      kinds: [
        dependencyVulnKind,
        codeScanningKind,
        changeRequestKind,
        issueKind,
        ...upcomingKinds,
      ],
      providers: [],
      defaults: runtimeDefaults,
    });

    expect(catalog.kind("dependency-vuln")?.label).toBe("Dependencies");
    expect(catalog.filtersFor("dependency-vuln").map((axis) => axis.id))
      .toEqual(expect.arrayContaining(["tier", "severity", "fix-available"]));
    expect(catalog.sortsFor("code-scanning").map((sort) => sort.id))
      .toContain("cs-severity");
    expect(catalog.chartsFor(["dependency-vuln"]).map((chart) => chart.id))
      .toContain("dv-fixable");
    expect(catalog.viewsFor("issue").map((view) => view.id))
      .toContain("code-review");
    expect(catalog.kind("cloud-misconfig")?.status).toBe("upcoming");
  });
});
