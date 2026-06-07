// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderToolbar, type ToolbarProps } from "../../src/runtime/layout/toolbar";
import type { ScoredItem } from "../../src/runtime/layout/triage-table";
import { emptyFacetState } from "../../src/runtime/layout/facet-bar";

const rows: ScoredItem[] = [{
  id: "1", source: "github", kind: "change-request", title: "t", location: "acme/api",
  signal: 0, createdAt: "2026-06-01T00:00:00Z", url: "", score: 10, tier: "P2",
  details: { author: { login: "x", avatarUrl: "", kind: "human" }, labels: [] } as any,
} as ScoredItem];

function props(over: Partial<ToolbarProps> = {}): ToolbarProps {
  return {
    artifact: { id: "change-request", label: "Pull requests", group: "work", kinds: ["change-request"] },
    rows, facets: emptyFacetState(),
    viewModes: [{ id: "list", label: "List" }, { id: "insights", label: "Insights" }],
    activeView: "list",
    providers: [{ id: "github-review", label: "github", on: true, live: true }],
    onFacetChange: () => {}, onViewChange: () => {}, onProviderToggle: () => {},
    ...over,
  };
}

describe("renderToolbar", () => {
  it("renders view-mode tabs on the left with the active one marked", () => {
    const host = document.createElement("div");
    renderToolbar(host, props());
    const active = host.querySelector(".tb-view.active");
    expect(active?.textContent).toBe("List");
  });
  it("renders Filter and Sort buttons", () => {
    const host = document.createElement("div");
    renderToolbar(host, props());
    expect(host.querySelector("[data-tb-filter]")).toBeTruthy();
    expect(host.querySelector("[data-tb-sort]")).toBeTruthy();
  });
  it("shows the active-filter count on the Filter button", () => {
    const host = document.createElement("div");
    renderToolbar(host, props({ facets: { axes: { tier: ["P0", "P1"] }, sort: "priority" } }));
    expect(host.querySelector("[data-tb-filter]")!.textContent).toContain("2");
  });
  it("emits onViewChange when a tab is clicked", () => {
    const host = document.createElement("div");
    let got = "";
    renderToolbar(host, props({ onViewChange: (id) => { got = id; } }));
    host.querySelectorAll<HTMLElement>(".tb-view")[1].click();
    expect(got).toBe("insights");
  });

  it("clicking a sort button emits onFacetChange with the new sort id", () => {
    const host = document.createElement("div");
    const onFacetChange = vi.fn();
    renderToolbar(host, props({ onFacetChange }));
    // [data-sort] buttons exist in the DOM regardless of popover hidden state
    const recentBtn = host.querySelector<HTMLElement>("[data-sort='recent']");
    expect(recentBtn).not.toBeNull();
    recentBtn!.click();
    expect(onFacetChange).toHaveBeenCalledOnce();
    expect(onFacetChange.mock.calls[0][0].sort).toBe("recent");
  });

  it("checking a filter axis checkbox emits onFacetChange with that value in .axes", () => {
    const host = document.createElement("div");
    const onFacetChange = vi.fn();
    // rows.length > 0, so the 'tier' axis always applies and renders checkboxes
    renderToolbar(host, props({ onFacetChange }));
    const tierCb = host.querySelector<HTMLInputElement>("[data-axis='tier'][data-val='P0']");
    expect(tierCb).not.toBeNull();
    tierCb!.checked = true;
    tierCb!.dispatchEvent(new Event("change"));
    expect(onFacetChange).toHaveBeenCalledOnce();
    expect(onFacetChange.mock.calls[0][0].axes.tier).toEqual(["P0"]);
  });
});
