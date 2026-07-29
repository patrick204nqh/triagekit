import type { ScoredItem } from "../table/kind-renderer";
import type { Artifact } from "../../dataset/artifact";
import { esc } from "../util";
import { applyFilters, type ListState } from "./filter-state";
import { runtimeCatalog } from "../../catalog/built-in";
import type { RuntimeCatalog } from "../../catalog/types";
import { type AxisCtx, type FilterAxis, type AxisOption } from "./axis-registry";
import { renderProviderSwitch, type SwitchProvider } from "../navigation/provider-switch";
import { renderRepoTabs, type RepoOption } from "../navigation/repo-tabs";
import { chipHtml } from "../atoms/atoms";
import { wirePopovers } from "./toolbar-popover";
import type { FocusPolicySnapshot, LabelRules } from "../../focus/types";
import {
  renderSelectionControls,
  type SelectionControlsProps,
} from "../delegation/selection-controls";

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
  focusPolicy: FocusPolicySnapshot;
  onFilterChange: (next: ListState) => void;
  onLabelRulesChange: (next: LabelRules) => void;
  onViewChange: (id: string) => void;
  onProviderSelect: (id: string) => void;
  onRepoSelect: (id: string) => void;
  catalog?: RuntimeCatalog;
  delegationSelection?: SelectionControlsProps;
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

function labelRuleOptHtml(
  mode: "include" | "exclude",
  option: AxisOption,
  checked: boolean,
): string {
  const body = option.chip
    ? chipHtml(option.label, option.chip.color)
    : `<span>${esc(option.label)}</span>`;
  const action = checked ? "Remove" : "Add";
  const lane = mode === "include" ? "shown" : "hidden";
  return `<label class="pop-opt${checked ? " on" : ""}">`
    + `<input type="checkbox" class="pop-ck" data-label-mode="${mode}" data-val="${esc(option.value)}" aria-label="${action} ${esc(option.label)} ${lane} label"${checked ? " checked" : ""}/>`
    + `<span class="ck">${CHECK_SVG}</span>${body}</label>`;
}

export function renderToolbar(host: HTMLElement, p: ToolbarProps): void {
  const catalog = p.catalog ?? runtimeCatalog;
  const ctx: AxisCtx = { artifact: p.artifact };
  const axes = catalog.filtersFor(p.artifact.kinds[0])
    .filter((axis) => axis.id !== "labels")
    .filter(a => a.appliesTo(p.rows, ctx));
  const labelAxis = catalog.filtersFor(p.artifact.kinds[0])
    .find((axis) => axis.id === "labels");
  const sorts = catalog.sortsFor(p.artifact.kinds[0])
    .filter(s => !s.appliesTo || s.appliesTo(ctx));
  const sel = (id: string) => p.filters.axes[id] ?? [];
  const labelCount = p.focusPolicy.labels.enabled
    ? p.focusPolicy.labels.include.length + p.focusPolicy.labels.exclude.length
    : 0;
  const fcount = activeFilterCount(p.filters) + labelCount;
  const curSort = sorts.find(s => s.id === p.filters.sort)?.label ?? "Priority";
  // p.rows is the active-repository-scoped set; count what the
  // filters actually leave visible vs. that scoped total, so the badge never claims
  // more rows than the table shows.
  const total = p.rows.length;
  const shown = applyFilters(
    p.rows,
    p.filters,
    catalog,
    p.focusPolicy,
  ).length;
  const countLabel = shown === total ? `${total}` : `${shown} / ${total}`;

  const views = p.viewModes.map(v => {
    const active = v.id === p.activeView;
    return `<button id="view-tab-${esc(v.id)}" class="tb-view${active ? " active" : ""}" data-view="${esc(v.id)}" role="tab" aria-selected="${active}" aria-controls="root" tabindex="${active ? "0" : "-1"}">${esc(v.label)}</button>`;
  }).join("");

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

  const labelOptions = labelAxis?.optionsFrom(p.rows, ctx) ?? [];
  const labelLane = (
    mode: "include" | "exclude",
    label: string,
    selected: readonly string[],
  ) => {
    const long = labelOptions.length > SEARCH_THRESHOLD;
    const search = long
      ? `<div class="pop-search"><input type="search" class="pop-filter" data-filter-axis="labels-${mode}" placeholder="Filter labels…" aria-label="Filter ${esc(label)}"/></div>`
      : "";
    const items = labelOptions.map((option) => labelRuleOptHtml(
      mode,
      option,
      selected.includes(option.value),
    )).join("") || `<div class="muted pop-empty">No labels in this list.</div>`;
    return `<div class="pop-axis label-lane" data-label-lane="${mode}">
      <div class="pop-axis-label">${label}</div>
      ${search}${long ? `<div class="opt-scroll">${items}</div>` : items}
    </div>`;
  };
  const labelRules = `<div class="label-rules-head">
      <span>Label focus</span>
      <button class="clear" data-label-rules-toggle>${p.focusPolicy.labels.enabled ? "Disable" : "Enable"}</button>
    </div>
    <div data-label-rules${p.focusPolicy.labels.enabled ? "" : " aria-disabled=\"true\""}>
      ${labelLane("include", "Show if labelled", p.focusPolicy.labels.include)}
      ${labelLane("exclude", "Hide if labelled", p.focusPolicy.labels.exclude)}
    </div>`;
  const genericBody = axes.map(axisGroup).join("");
  const filterBody = `${genericBody}${labelRules}`;
  const filterFoot = fcount
    ? `<div class="pop-foot"><span class="count">${fcount} active</span><button class="clear" data-clear-all>Clear all</button></div>`
    : "";
  const filterPop = `<div class="tb-pop" id="tb-pop-filter" data-pop="filter" hidden><div class="pop-scroll">${filterBody}</div>${filterFoot}</div>`;
  const sortPop = `<div class="tb-pop" id="tb-pop-sort" data-pop="sort" hidden>`
    + sorts.map(s => `<button class="pop-sort${s.id === p.filters.sort ? " on" : ""}" data-sort="${esc(s.id)}">${esc(s.label)}</button>`).join("")
    + `</div>`;

  // Row 1: view tabs + provider scope switch (top-right)
  // Row 2 (.fbar): Filter + Sort controls, right-aligned, directly above the table
  const labelSummaryParts = [
    ...p.focusPolicy.labels.include.map((label) => `Label: ${label}`),
    ...p.focusPolicy.labels.exclude.map((label) => `Not label: ${label}`),
  ];
  const labelSummaryText = p.focusPolicy.labels.enabled
    ? (labelSummaryParts.join(" · ") || "All labels")
    : "Label focus paused";
  const labelSummaryActions = [
    ...p.focusPolicy.labels.include.map((label) =>
      `<button class="focus-label-remove" data-remove-label="include" data-val="${esc(label)}" aria-label="Remove ${esc(label)} from shown labels">×</button>`),
    ...p.focusPolicy.labels.exclude.map((label) =>
      `<button class="focus-label-remove" data-remove-label="exclude" data-val="${esc(label)}" aria-label="Remove ${esc(label)} from hidden labels">×</button>`),
  ].join("");

  host.innerHTML = `<div class="toolbar">
      <div class="tb-left" role="tablist" aria-label="Dashboard view">${views}<span class="tb-count">${countLabel}</span></div>
    <div class="tb-right"><div data-provider-switch></div></div>
  </div>
  <div class="fbar">
    <div class="fbar-focus"><div data-repo-tabs></div><div class="focus-label-summary"><span>${esc(labelSummaryText)}</span>${labelSummaryActions}</div></div>
    <div class="fbar-controls">
      <div data-delegation-selection></div>
      <div class="tb-ctl"><button class="tb-btn" data-tb-filter aria-haspopup="true" aria-controls="tb-pop-filter">≡ Filter${fcount ? ` · ${fcount}` : ""}</button>${filterPop}</div>
      <div class="tb-ctl"><button class="tb-btn" data-tb-sort aria-haspopup="true" aria-controls="tb-pop-sort">↕ ${esc(curSort)}</button>${sortPop}</div>
    </div>
  </div>`;

  // Mount the provider scope switch into its dedicated host slot
  const provHost = host.querySelector<HTMLElement>("[data-provider-switch]")!;
  renderProviderSwitch(provHost, { providers: p.providers, onSelect: p.onProviderSelect });

  const repoHost = host.querySelector<HTMLElement>("[data-repo-tabs]")!;
  renderRepoTabs(repoHost, { repos: p.repos, active: p.activeRepo, onSelect: p.onRepoSelect });
  const selectionHost = host.querySelector<HTMLElement>(
    "[data-delegation-selection]",
  )!;
  if (p.delegationSelection) {
    renderSelectionControls(selectionHost, p.delegationSelection);
  } else {
    selectionHost.remove();
  }

  // View tabs
  const viewButtons = [
    ...host.querySelectorAll<HTMLElement>(".tb-view"),
  ];
  viewButtons.forEach((button, index) => {
    button.addEventListener("click", () =>
      p.onViewChange(button.dataset.view!));
    button.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const offset = event.key === "ArrowRight" ? 1 : -1;
      const next = viewButtons[
        (index + offset + viewButtons.length) % viewButtons.length
      ];
      next.focus();
      p.onViewChange(next.dataset.view!);
    });
  });

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
  host.querySelectorAll<HTMLInputElement>("[data-label-mode]").forEach((cb) =>
    cb.addEventListener("change", () => {
      cb.closest(".pop-opt")?.classList.toggle("on", cb.checked);
      const mode = cb.dataset.labelMode as "include" | "exclude";
      const value = cb.dataset.val!;
      const current = p.focusPolicy.labels[mode];
      p.onLabelRulesChange({
        ...p.focusPolicy.labels,
        [mode]: current.includes(value)
          ? current.filter((label) => label !== value)
          : [...current, value],
      });
    }));
  host.querySelector<HTMLElement>("[data-label-rules-toggle]")
    ?.addEventListener("click", () => p.onLabelRulesChange({
      ...p.focusPolicy.labels,
      enabled: !p.focusPolicy.labels.enabled,
    }));
  host.querySelectorAll<HTMLElement>("[data-remove-label]").forEach((button) =>
    button.addEventListener("click", () => {
      const mode = button.dataset.removeLabel as "include" | "exclude";
      p.onLabelRulesChange({
        ...p.focusPolicy.labels,
        [mode]: p.focusPolicy.labels[mode].filter((label) =>
          label !== button.dataset.val),
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

  host.querySelector<HTMLElement>("[data-clear-all]")
    ?.addEventListener("click", () => {
      p.onFilterChange({ axes: {}, sort: p.filters.sort });
      p.onLabelRulesChange({ include: [], exclude: [], enabled: true });
    });

  wirePopovers(host);
}
