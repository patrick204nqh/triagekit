import { describe, it, expect } from "vitest";
import { toolbarPropsFromShell } from "../../src/runtime/shell/app-shell";

// toolbarPropsFromShell is a small pure helper extracted from app-shell so the
// view-mode/provider/facet assembly is testable without mounting the whole shell.
describe("toolbarPropsFromShell", () => {
  it("lists List + Insights when insights is enabled", () => {
    const p = toolbarPropsFromShell({
      artifact: { id: "issues", label: "Issues", group: "work", kinds: ["issue"] },
      rows: [], facets: { axes: {}, sort: "priority" },
      hasInsights: true, activeView: "list",
      sources: [{ id: "github-review", provider: "github", status: "ready" } as any],
      selected: new Set(["github-review"]),
      extraTabs: [],
    });
    expect(p.viewModes.map(v => v.id)).toContain("insights");
    expect(p.providers[0]).toMatchObject({ id: "github-review", on: true, live: true });
  });
});
