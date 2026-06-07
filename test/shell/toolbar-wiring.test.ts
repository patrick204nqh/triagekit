import { describe, it, expect } from "vitest";
import { toolbarPropsFromShell } from "../../src/runtime/shell/app-shell";

// toolbarPropsFromShell is a small pure helper extracted from app-shell so the
// view-mode/provider/facet assembly is testable without mounting the whole shell.
describe("toolbarPropsFromShell", () => {
  it("lists List + Insights when insights is enabled", () => {
    const p = toolbarPropsFromShell({
      artifact: { id: "issue", label: "Issues", group: "work", kinds: ["issue"] },
      rows: [], facets: { axes: {}, sort: "priority" },
      hasInsights: true, activeView: "list",
      sources: [{ id: "github-review", provider: "github", status: "ready" } as any],
      activeProvider: "github-review",
      extraTabs: [],
    });
    expect(p.viewModes.map(v => v.id)).toContain("insights");
    expect(p.providers[0]).toMatchObject({ id: "github-review", on: true, live: true });
  });

  it("marks exactly one provider active (single-select scope)", () => {
    const props = toolbarPropsFromShell({
      artifact: { id: "dependency-vuln", label: "Dependencies", group: "finding", kinds: ["dependency-vuln"] },
      rows: [], facets: { axes: {}, sort: "priority" }, hasInsights: false, activeView: "list",
      sources: [
        { id: "github", provider: "github", status: "ready" },
        { id: "gitlab", provider: "gitlab", status: "upcoming" },
      ],
      activeProvider: "github", extraTabs: [],
    });
    expect(props.providers.filter(p => p.on)).toHaveLength(1);
    expect(props.providers.find(p => p.id === "github")!.on).toBe(true);
    expect(props.providers.find(p => p.id === "gitlab")!.on).toBe(false);
    expect(props.providers.find(p => p.id === "gitlab")!.live).toBe(false);
  });
});
