import type { ScoredItem } from "./table/kind-renderer";
import type { Artifact } from "../dataset/artifact";
import { esc } from "./util";
import { type ListState } from "./filter-state";
import { listFilterAxes, listSortKeys, type AxisCtx, type FilterAxis } from "./axis-registry";
import { renderProviderSwitch, type SwitchProvider } from "./provider-switch";
import { renderRepoTabs, type RepoOption } from "./repo-tabs";
import { wirePopovers } from "./toolbar-popover";

export interface ToolbarViewMode { id: string; label: string; }
// The toolbar's provider rows ARE the provider-switch's inputs — one shape, one source of truth.
export type ToolbarProvider = SwitchProvider;
export interface ToolbarProps {
  artifact: Artifact;
  rows: ScoredItem[];
  filters: ListState;
  viewModes: ToolbarViewMode[];
  activeView: string;
  providers: ToolbarProvider[];
  repos: RepoOption[];
  activeRepo: string;
  onFilterChange: (next: ListState) => void;
  onViewChange: (id: string) => void;
  onProviderSelect: (id: string) => void;
  onRepoSelect: (id: string) => void;
}

function activeFilterCount(state: ListState): number {
  return Object.values(state.axes).reduce((n, v) => n + (v?.length ?? 0), 0);
}

export function renderToolbar(host: HTMLElement, p: ToolbarProps): void {
  const ctx: AxisCtx = { artifact: p.artifact };
  const axes = listFilterAxes().filter(a => a.appliesTo(p.rows, ctx));
  const sorts = listSortKeys().filter(s => !s.appliesTo || s.appliesTo(ctx));
  const sel = (id: string) => p.filters.axes[id] ?? [];
  const fcount = activeFilterCount(p.filters);
  const curSort = sorts.find(s => s.id === p.filters.sort)?.label ?? "Priority";

  const views = p.viewModes.map(v =>
    `<button class="tb-view${v.id === p.activeView ? " active" : ""}" data-view="${esc(v.id)}">${esc(v.label)}</button>`).join("");

  const axisGroup = (a: FilterAxis) =>
    `<div class="pop-axis"><div class="pop-axis-label">${esc(a.label)}</div>`
    + a.optionsFrom(p.rows, ctx).map(o =>
        `<label class="pop-opt"><input type="checkbox" data-axis="${esc(a.id)}" data-val="${esc(o.value)}"${sel(a.id).includes(o.value) ? " checked" : ""}/> ${esc(o.label)}</label>`).join("")
    + `</div>`;

  const filterPop = `<div class="tb-pop" data-pop="filter" hidden>${axes.map(axisGroup).join("") || `<div class="muted pop-empty">No filters for this list.</div>`}</div>`;
  const sortPop = `<div class="tb-pop" data-pop="sort" hidden>`
    + sorts.map(s => `<button class="pop-sort${s.id === p.filters.sort ? " on" : ""}" data-sort="${esc(s.id)}">${esc(s.label)}</button>`).join("")
    + `</div>`;

  // Row 1: view tabs + provider scope switch (top-right)
  // Row 2 (.fbar): Filter + Sort controls, right-aligned, directly above the table
  host.innerHTML = `<div class="toolbar">
    <div class="tb-left">${views}<span class="tb-count">${p.rows.length}</span></div>
    <div class="tb-right"><div data-provider-switch></div></div>
  </div>
  <div class="fbar">
    <div data-repo-tabs></div>
    <div class="fbar-controls">
      <div class="tb-ctl"><button class="tb-btn" data-tb-filter aria-haspopup="true">≡ Filter${fcount ? ` · ${fcount}` : ""}</button>${filterPop}</div>
      <div class="tb-ctl"><button class="tb-btn" data-tb-sort aria-haspopup="true">↕ ${esc(curSort)}</button>${sortPop}</div>
    </div>
  </div>`;

  // Mount the provider scope switch into its dedicated host slot
  const provHost = host.querySelector<HTMLElement>("[data-provider-switch]")!;
  renderProviderSwitch(provHost, { providers: p.providers, onSelect: p.onProviderSelect });

  const repoHost = host.querySelector<HTMLElement>("[data-repo-tabs]")!;
  renderRepoTabs(repoHost, { repos: p.repos, active: p.activeRepo, onSelect: p.onRepoSelect });

  // View tabs
  host.querySelectorAll<HTMLElement>(".tb-view").forEach(b =>
    b.addEventListener("click", () => p.onViewChange(b.dataset.view!)));

  // Emit helper for filter mutations (clone like filter-state does).
  const emit = (mut: (s: ListState) => void) => {
    const clone: ListState = { axes: {}, sort: p.filters.sort };
    for (const [k, v] of Object.entries(p.filters.axes)) clone.axes[k] = [...v];
    mut(clone); p.onFilterChange(clone);
  };
  host.querySelectorAll<HTMLInputElement>("[data-axis]").forEach(cb =>
    cb.addEventListener("change", () => emit(s => {
      const id = cb.dataset.axis!, val = cb.dataset.val!;
      const cur = s.axes[id] ?? [];
      s.axes[id] = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val];
    })));
  host.querySelectorAll<HTMLElement>("[data-sort]").forEach(b =>
    b.addEventListener("click", () => emit(s => { s.sort = b.dataset.sort!; })));

  wirePopovers(host);
}
