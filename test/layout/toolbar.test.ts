// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderToolbar, type ToolbarProps } from "../../src/runtime/layout/toolbar/toolbar";
import type { ScoredItem } from "../../src/runtime/layout/table/kind-renderer";
import { emptyListState } from "../../src/runtime/layout/toolbar/filter-state";

const rows: ScoredItem[] = [{
  id: "1", source: "github", kind: "change-request", title: "t", location: "acme/api",
  signal: 0, createdAt: "2026-06-01T00:00:00Z", url: "", score: 10, tier: "P2",
  details: { author: { login: "x", avatarUrl: "", kind: "human" }, labels: [] } as any,
} as ScoredItem];

function props(over: Partial<ToolbarProps> = {}): ToolbarProps {
  return {
    artifact: { id: "change-request", label: "Pull requests", group: "work", kinds: ["change-request"] },
    rows, filters: emptyListState(),
    viewModes: [{ id: "list", label: "List" }, { id: "insights", label: "Insights" }],
    activeView: "list",
    providers: [{ id: "github-review", label: "github", on: true, live: true }],
    repos: [], activeRepo: "",
    onFilterChange: () => {}, onViewChange: () => {}, onProviderSelect: () => {}, onRepoSelect: () => {},
    ...over,
  };
}

const labelledRows = (...labels: { name: string; color: string }[]): ScoredItem[] => [{
  ...rows[0], id: "L",
  details: { author: { login: "x", avatarUrl: "", kind: "human" }, labels } as any,
} as ScoredItem];

describe("renderToolbar", () => {
  it("renders label options as colored chips, keeping the data-axis/data-val input", () => {
    const host = document.createElement("div");
    renderToolbar(host, props({ rows: labelledRows({ name: "bug", color: "d73a4a" }) }));
    const input = host.querySelector<HTMLInputElement>("[data-axis='labels'][data-val='bug']");
    expect(input).not.toBeNull();                                   // state-driving input still present
    const opt = input!.closest(".pop-opt")!;
    expect(opt.querySelector(".lbl")?.getAttribute("style")).toContain("--lbl:#d73a4a");
    expect(opt.querySelector(".ck")).not.toBeNull();                // custom checkbox visual
  });

  it("toggling a label checkbox marks its row .on", () => {
    const host = document.createElement("div");
    renderToolbar(host, props({ rows: labelledRows({ name: "bug", color: "d73a4a" }), onFilterChange: () => {} }));
    const input = host.querySelector<HTMLInputElement>("[data-axis='labels'][data-val='bug']")!;
    input.checked = true;
    input.dispatchEvent(new Event("change"));
    expect(input.closest(".pop-opt")!.classList.contains("on")).toBe(true);
  });

  const manyLabels = (n: number): ScoredItem[] => labelledRows(
    ...Array.from({ length: n }, (_, i) => ({ name: `lbl-${i}`, color: "888888" })));

  it("shows a search box only for axes past the threshold", () => {
    const few = document.createElement("div");
    renderToolbar(few, props({ rows: manyLabels(4) }));
    expect(few.querySelector("[data-filter-axis='labels']")).toBeNull();          // 4 <= 8

    const many = document.createElement("div");
    renderToolbar(many, props({ rows: manyLabels(9) }));
    expect(many.querySelector("[data-filter-axis='labels']")).not.toBeNull();     // 9 > 8
    expect(many.querySelector("[data-filter-axis='tier']")).toBeNull();           // tier has 4 fixed options
  });

  it("typing in the search box hides non-matching options", () => {
    const host = document.createElement("div");
    renderToolbar(host, props({ rows: labelledRows(
      { name: "bug", color: "d73a4a" }, { name: "security", color: "b60205" },
      { name: "docs", color: "0075ca" }, { name: "epic", color: "5319e7" },
      { name: "perf", color: "0e8a16" }, { name: "ci", color: "fbca04" },
      { name: "ux", color: "a2eeef" }, { name: "api", color: "cfd3d7" },
      { name: "auth", color: "8957e5" }) }));   // 9 labels -> search shown
    const search = host.querySelector<HTMLInputElement>("[data-filter-axis='labels']")!;
    search.value = "se";
    search.dispatchEvent(new Event("input"));
    const visible = (val: string) => {
      const opt = host.querySelector<HTMLElement>(`[data-axis='labels'][data-val='${val}']`)!.closest(".pop-opt") as HTMLElement;
      return opt.style.display !== "none";
    };
    expect(visible("security")).toBe(true);   // matches "se"
    expect(visible("bug")).toBe(false);        // hidden
  });

  it("wraps a long option list in .opt-scroll, short ones not", () => {
    const many = document.createElement("div");
    renderToolbar(many, props({ rows: manyLabels(9) }));
    expect(many.querySelector(".opt-scroll")).not.toBeNull();

    const few = document.createElement("div");
    renderToolbar(few, props({ rows: manyLabels(3) }));
    expect(few.querySelector(".opt-scroll")).toBeNull();
  });

  it("renders a Clear-all footer only when filters are active", () => {
    const none = document.createElement("div");
    renderToolbar(none, props());                                          // no filters
    expect(none.querySelector("[data-clear-all]")).toBeNull();

    const some = document.createElement("div");
    renderToolbar(some, props({ filters: { axes: { tier: ["P0"] }, sort: "priority" } }));
    expect(some.querySelector("[data-clear-all]")).not.toBeNull();
    expect(some.querySelector(".pop-foot")!.textContent).toContain("1");   // active count
  });

  it("Clear-all emits an empty axes state, preserving sort", () => {
    const host = document.createElement("div");
    const onFilterChange = vi.fn();
    renderToolbar(host, props({ filters: { axes: { tier: ["P0", "P1"] }, sort: "recent" }, onFilterChange }));
    host.querySelector<HTMLElement>("[data-clear-all]")!.click();
    expect(onFilterChange).toHaveBeenCalledOnce();
    expect(onFilterChange.mock.calls[0][0]).toEqual({ axes: {}, sort: "recent" });
  });

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
    renderToolbar(host, props({ filters: { axes: { tier: ["P0", "P1"] }, sort: "priority" } }));
    expect(host.querySelector("[data-tb-filter]")!.textContent).toContain("2");
  });
  it("emits onViewChange when a tab is clicked", () => {
    const host = document.createElement("div");
    let got = "";
    renderToolbar(host, props({ onViewChange: (id) => { got = id; } }));
    host.querySelectorAll<HTMLElement>(".tb-view")[1].click();
    expect(got).toBe("insights");
  });

  it("clicking a sort button emits onFilterChange with the new sort id", () => {
    const host = document.createElement("div");
    const onFilterChange = vi.fn();
    renderToolbar(host, props({ onFilterChange }));
    // [data-sort] buttons exist in the DOM regardless of popover hidden state
    const recentBtn = host.querySelector<HTMLElement>("[data-sort='recent']");
    expect(recentBtn).not.toBeNull();
    recentBtn!.click();
    expect(onFilterChange).toHaveBeenCalledOnce();
    expect(onFilterChange.mock.calls[0][0].sort).toBe("recent");
  });

  it("checking a filter axis checkbox emits onFilterChange with that value in .axes", () => {
    const host = document.createElement("div");
    const onFilterChange = vi.fn();
    // rows.length > 0, so the 'tier' axis always applies and renders checkboxes
    renderToolbar(host, props({ onFilterChange }));
    const tierCb = host.querySelector<HTMLInputElement>("[data-axis='tier'][data-val='P0']");
    expect(tierCb).not.toBeNull();
    tierCb!.checked = true;
    tierCb!.dispatchEvent(new Event("change"));
    expect(onFilterChange).toHaveBeenCalledOnce();
    expect(onFilterChange.mock.calls[0][0].axes.tier).toEqual(["P0"]);
  });

  it("shows a truthful 'shown / total' count when filters hide some rows", () => {
    const host = document.createElement("div");
    const mk = (id: string, tier: ScoredItem["tier"]): ScoredItem => ({
      ...rows[0], id, tier,
    });
    const three = [mk("a", "P0"), mk("b", "P1"), mk("c", "P2")];
    renderToolbar(host, props({ rows: three, filters: { axes: { tier: ["P0"] }, sort: "priority" } }));
    const count = host.querySelector(".tb-count")!.textContent!;
    expect(count).toContain("1");   // one row shown
    expect(count).toContain("3");   // of three total
  });

  it("shows a single number when nothing is filtered out", () => {
    const host = document.createElement("div");
    renderToolbar(host, props());   // one row, no filters
    expect(host.querySelector(".tb-count")!.textContent!.trim()).toBe("1");
  });

  it("mounts the provider-switch in row 1 and the filter/sort row below it", () => {
    const host = document.createElement("div");
    renderToolbar(host, props({
      providers: [{ id: "github", label: "github", on: true, live: true },
                  { id: "gitlab", label: "gitlab", on: false, live: false }],
    }));
    expect(host.querySelector("[data-provider-switch]")).toBeTruthy();
    expect(host.querySelectorAll("[data-prov]").length).toBe(2);   // switch rendered into the slot
    expect(host.querySelector(".fbar")).toBeTruthy();              // filter/sort live on their own row
  });
});
