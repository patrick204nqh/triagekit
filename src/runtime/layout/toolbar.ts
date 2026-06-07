import type { ScoredItem } from "./triage-table";
import type { Artifact } from "../dataset/artifact";
import { esc } from "./triage-table";
import { type ListState } from "./filter-state";
import { listFilterAxes, listSortKeys, type AxisCtx, type FilterAxis } from "./axis-registry";
import { dismissible } from "../shell/dismissible";

export interface ToolbarViewMode { id: string; label: string; }
export interface ToolbarProvider { id: string; label: string; on: boolean; live: boolean; }
export interface ToolbarProps {
  artifact: Artifact;
  rows: ScoredItem[];
  facets: ListState;
  viewModes: ToolbarViewMode[];
  activeView: string;
  providers: ToolbarProvider[];
  onFacetChange: (next: ListState) => void;
  onViewChange: (id: string) => void;
  onProviderToggle: (id: string) => void;
}

function activeFilterCount(state: ListState): number {
  return Object.values(state.axes).reduce((n, v) => n + (v?.length ?? 0), 0);
}

export function renderToolbar(host: HTMLElement, p: ToolbarProps): void {
  const ctx: AxisCtx = { artifact: p.artifact };
  // The provider dimension is owned by the "Provider sources" fetch toggle below,
  // not a filter axis — exclude the registry `provider` axis to avoid two redundant
  // provider controls in the same popover for multi-provider artifacts.
  const axes = listFilterAxes().filter(a => a.id !== "provider" && a.appliesTo(p.rows, ctx));
  const sorts = listSortKeys().filter(s => !s.appliesTo || s.appliesTo(ctx));
  const sel = (id: string) => p.facets.axes[id] ?? [];
  const fcount = activeFilterCount(p.facets);
  const curSort = sorts.find(s => s.id === p.facets.sort)?.label ?? "Priority";

  const views = p.viewModes.map(v =>
    `<button class="tb-view${v.id === p.activeView ? " active" : ""}" data-view="${esc(v.id)}">${esc(v.label)}</button>`).join("");

  const providerToggles = p.providers.length > 1
    ? `<div class="pop-axis"><div class="pop-axis-label">Provider sources</div>`
      + p.providers.map(pr => `<label class="pop-opt"><input type="checkbox" data-prov="${esc(pr.id)}"${pr.on ? " checked" : ""}${pr.live ? "" : " disabled"}/> ${esc(pr.label)}${pr.live ? "" : " (upcoming)"}</label>`).join("")
      + `</div>`
    : "";

  const axisGroup = (a: FilterAxis) =>
    `<div class="pop-axis"><div class="pop-axis-label">${esc(a.label)}</div>`
    + a.optionsFrom(p.rows, ctx).map(o =>
        `<label class="pop-opt"><input type="checkbox" data-axis="${esc(a.id)}" data-val="${esc(o.value)}"${sel(a.id).includes(o.value) ? " checked" : ""}/> ${esc(o.label)}</label>`).join("")
    + `</div>`;

  const filterPop = `<div class="tb-pop" data-pop="filter" hidden>${providerToggles}${axes.map(axisGroup).join("") || `<div class="muted pop-empty">No filters for this list.</div>`}</div>`;
  const sortPop = `<div class="tb-pop" data-pop="sort" hidden>`
    + sorts.map(s => `<button class="pop-sort${s.id === p.facets.sort ? " on" : ""}" data-sort="${esc(s.id)}">${esc(s.label)}</button>`).join("")
    + `</div>`;

  host.innerHTML = `<div class="toolbar">
    <div class="tb-left">${views}<span class="tb-count">${p.rows.length}</span></div>
    <div class="tb-right">
      <div class="tb-ctl"><button class="tb-btn" data-tb-filter aria-haspopup="true">≡ Filter${fcount ? ` · ${fcount}` : ""}</button>${filterPop}</div>
      <div class="tb-ctl"><button class="tb-btn" data-tb-sort aria-haspopup="true">↕ ${esc(curSort)}</button>${sortPop}</div>
    </div></div>`;

  // View tabs
  host.querySelectorAll<HTMLElement>(".tb-view").forEach(b =>
    b.addEventListener("click", () => p.onViewChange(b.dataset.view!)));

  // Emit helper for filter mutations (clone like filter-state does).
  const emit = (mut: (s: ListState) => void) => {
    const clone: ListState = { axes: {}, sort: p.facets.sort };
    for (const [k, v] of Object.entries(p.facets.axes)) clone.axes[k] = [...v];
    mut(clone); p.onFacetChange(clone);
  };
  host.querySelectorAll<HTMLInputElement>("[data-axis]").forEach(cb =>
    cb.addEventListener("change", () => emit(s => {
      const id = cb.dataset.axis!, val = cb.dataset.val!;
      const cur = s.axes[id] ?? [];
      s.axes[id] = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val];
    })));
  host.querySelectorAll<HTMLInputElement>("[data-prov]").forEach(cb =>
    cb.addEventListener("change", () => p.onProviderToggle(cb.dataset.prov!)));
  host.querySelectorAll<HTMLElement>("[data-sort]").forEach(b =>
    b.addEventListener("click", () => emit(s => { s.sort = b.dataset.sort!; })));

  // Popovers via the shared dismissible helper (Esc / outside-click close).
  // Single active handle/pop hoisted outside the loop so switching filter↔sort
  // properly releases whichever popover is currently open (fixes double-Esc bug).
  let activeHandle: ReturnType<typeof dismissible> | null = null;
  let activePop: HTMLElement | null = null;

  for (const which of ["filter", "sort"] as const) {
    const btn = host.querySelector<HTMLElement>(`[data-tb-${which}]`)!;
    const pop = host.querySelector<HTMLElement>(`[data-pop="${which}"]`)!;
    btn.addEventListener("click", () => {
      const opening = pop.hidden;
      if (activePop) activePop.hidden = true;
      if (activeHandle) { activeHandle.release(); activeHandle = null; activePop = null; }
      if (opening) {
        pop.hidden = false;
        activeHandle = dismissible(pop, { onDismiss: () => { pop.hidden = true; activeHandle = null; activePop = null; } });
        activeHandle.activate();
        activePop = pop;
      }
    });
  }
}
