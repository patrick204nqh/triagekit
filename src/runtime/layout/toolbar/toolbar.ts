import type { ScoredItem } from "../table/kind-renderer";
import type { Artifact } from "../../dataset/artifact";
import { esc } from "../util";
import { applyFilters, type ListState } from "./filter-state";
import { listFilterAxes, listSortKeys, type AxisCtx, type FilterAxis, type AxisOption } from "./axis-registry";
import { renderProviderSwitch, type SwitchProvider } from "../navigation/provider-switch";
import { renderRepoTabs, type RepoOption } from "../navigation/repo-tabs";
import { chipHtml } from "../atoms/atoms";
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

const SEARCH_THRESHOLD = 8;
const CHECK_SVG = `<svg class="ck-tick" viewBox="0 0 10 10" aria-hidden="true"><path d="M1 5l3 3 5-7"/></svg>`;

function optHtml(axisId: string, o: AxisOption, checked: boolean): string {
  const body = o.chip ? chipHtml(o.label, o.chip.color) : `<span>${esc(o.label)}</span>`;
  return `<label class="pop-opt${checked ? " on" : ""}">`
    + `<input type="checkbox" class="pop-ck" data-axis="${esc(axisId)}" data-val="${esc(o.value)}"${checked ? " checked" : ""}/>`
    + `<span class="ck">${CHECK_SVG}</span>${body}</label>`;
}

export function renderToolbar(host: HTMLElement, p: ToolbarProps): void {
  const ctx: AxisCtx = { artifact: p.artifact };
  const axes = listFilterAxes().filter(a => a.appliesTo(p.rows, ctx));
  const sorts = listSortKeys().filter(s => !s.appliesTo || s.appliesTo(ctx));
  const sel = (id: string) => p.filters.axes[id] ?? [];
  const fcount = activeFilterCount(p.filters);
  const curSort = sorts.find(s => s.id === p.filters.sort)?.label ?? "Priority";
  // p.rows is the active-repo-scoped set (see toolbarPropsFromShell); count what the
  // filters actually leave visible vs. that scoped total, so the badge never claims
  // more rows than the table shows.
  const total = p.rows.length;
  const shown = applyFilters(p.rows, p.filters).length;
  const countLabel = shown === total ? `${total}` : `${shown} / ${total}`;

  const views = p.viewModes.map(v =>
    `<button class="tb-view${v.id === p.activeView ? " active" : ""}" data-view="${esc(v.id)}">${esc(v.label)}</button>`).join("");

  const axisGroup = (a: FilterAxis) => {
    const opts = a.optionsFrom(p.rows, ctx);
    const selected = sel(a.id);
    const long = opts.length > SEARCH_THRESHOLD;
    const search = long
      ? `<div class="pop-search"><input type="search" class="pop-filter" data-filter-axis="${esc(a.id)}" placeholder="Filter ${esc(a.label.toLowerCase())}…" aria-label="Filter ${esc(a.label)}"/></div>`
      : "";
    const items = opts.map(o => optHtml(a.id, o, selected.includes(o.value))).join("");
    const list = long ? `<div class="opt-scroll">${items}</div>` : items;
    return `<div class="pop-axis"><div class="pop-axis-label">${esc(a.label)}</div>${search}${list}</div>`;
  };

  const filterPop = `<div class="tb-pop" data-pop="filter" hidden>${axes.map(axisGroup).join("") || `<div class="muted pop-empty">No filters for this list.</div>`}</div>`;
  const sortPop = `<div class="tb-pop" data-pop="sort" hidden>`
    + sorts.map(s => `<button class="pop-sort${s.id === p.filters.sort ? " on" : ""}" data-sort="${esc(s.id)}">${esc(s.label)}</button>`).join("")
    + `</div>`;

  // Row 1: view tabs + provider scope switch (top-right)
  // Row 2 (.fbar): Filter + Sort controls, right-aligned, directly above the table
  host.innerHTML = `<div class="toolbar">
    <div class="tb-left">${views}<span class="tb-count">${countLabel}</span></div>
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
    cb.addEventListener("change", () => {
      cb.closest(".pop-opt")?.classList.toggle("on", cb.checked);
      emit(s => {
        const id = cb.dataset.axis!, val = cb.dataset.val!;
        const cur = s.axes[id] ?? [];
        s.axes[id] = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val];
      });
    }));
  host.querySelectorAll<HTMLElement>("[data-sort]").forEach(b =>
    b.addEventListener("click", () => emit(s => { s.sort = b.dataset.sort!; })));

  host.querySelectorAll<HTMLInputElement>("[data-filter-axis]").forEach(inp =>
    inp.addEventListener("input", () => {
      const group = inp.closest(".pop-axis")!;
      const q = inp.value.trim().toLowerCase();
      group.querySelectorAll<HTMLElement>(".pop-opt").forEach(opt => {
        opt.style.display = (opt.textContent ?? "").toLowerCase().includes(q) ? "" : "none";
      });
    }));

  wirePopovers(host);
}
