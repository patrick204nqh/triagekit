import { describe, it, expect } from "vitest";
import { toolbarPropsFromShell } from "../../src/runtime/shell/app-shell";
import type { ScoredItem } from "../../src/runtime/layout/triage-table";

const row = (location: string): ScoredItem => ({
  id: location + ":1", source: "github", kind: "issue", title: "t",
  location, signal: 1, createdAt: "2026-01-01T00:00:00Z", url: "", details: {},
  score: 1, tier: "P3",
});

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
      activeRepo: "",
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
      activeProvider: "github", activeRepo: "", extraTabs: [],
    });
    expect(props.providers.filter(p => p.on)).toHaveLength(1);
    expect(props.providers.find(p => p.id === "github")!.on).toBe(true);
    expect(props.providers.find(p => p.id === "gitlab")!.on).toBe(false);
    expect(props.providers.find(p => p.id === "gitlab")!.live).toBe(false);
  });

  it("lists distinct locations count-descending and passes activeRepo through", () => {
    const out = toolbarPropsFromShell({
      artifact: { id: "issue", label: "Issues", group: "work", kinds: ["issue"] },
      rows: [row("a"), row("a"), row("b")],   // a x2, b x1
      facets: { axes: {}, sort: "priority" },
      hasInsights: false, activeView: "list",
      sources: [{ id: "github", provider: "github", status: "ready" }],
      activeProvider: "github",
      activeRepo: "a",
      extraTabs: [],
    });
    expect(out.repos.map(r => r.id)).toEqual(["a", "b"]);  // count-descending
    expect(out.activeRepo).toBe("a");
  });

  it("coerces activeRepo to '' for display when the sticky repo is absent from the current options", () => {
    const out = toolbarPropsFromShell({
      artifact: { id: "issue", label: "Issues", group: "work", kinds: ["issue"] },
      rows: [row("a"), row("a"), row("b")],   // only a, b present
      facets: { axes: {}, sort: "priority" },
      hasInsights: false, activeView: "list",
      sources: [{ id: "github", provider: "github", status: "ready" }],
      activeProvider: "github",
      activeRepo: "ghost/repo",   // sticky from another artifact, not in this set
      extraTabs: [],
    });
    expect(out.repos.map(r => r.id)).toEqual(["a", "b"]);  // options unchanged
    expect(out.activeRepo).toBe("");                        // displayed as All
  });
});
