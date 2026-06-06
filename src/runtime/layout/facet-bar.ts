import type { ScoredItem } from "./triage-table";
import type { Artifact } from "../dataset/artifact";
import { esc } from "./triage-table";
import {
  getFilterAxis, getSortKey, listFilterAxes, listSortKeys,
  type AxisCtx, type FilterAxis,
} from "./facet-registry";

// Axis-keyed filter state. WHERE (provider) stays a fetch-level facet in app-shell.
export interface FacetState {
  axes: Record<string, string[]>;   // axisId -> selected values (empty/absent = all)
  sort: string;                     // sort-key id
}

export function emptyFacetState(): FacetState {
  return { axes: {}, sort: "priority" };
}

// Pure: filter by every axis that has a non-empty selection, then sort.
export function applyFacets(rows: ScoredItem[], state: FacetState): ScoredItem[] {
  let out = rows;
  for (const [axisId, vals] of Object.entries(state.axes)) {
    if (!vals || !vals.length) continue;
    const axis = getFilterAxis(axisId);
    if (axis) out = out.filter(i => axis.test(i, vals));
  }
  const sk = getSortKey(state.sort) ?? getSortKey("priority")!;
  return [...out].sort(sk.compare);
}

// Render the filter bar: quick axes inline (scope = select, others = chips), a
// "+ Filter" popover for applicable non-quick axes, and a sort select. Presentation
// + events only; never fetches. Each handler clones state and emits via onChange.
export function renderFacetBar(
  host: HTMLElement, artifact: Artifact, rows: ScoredItem[],
  state: FacetState, onChange: (next: FacetState) => void,
): void {
  const ctx: AxisCtx = { artifact };
  const applicable = listFilterAxes().filter(a => a.appliesTo(rows, ctx));
  const quick = applicable.filter(a => a.quick);
  const extra = applicable.filter(a => !a.quick);
  const sel = (id: string): string[] => state.axes[id] ?? [];

  const label = (t: string) => `<span class="facet-label">${esc(t)}</span>`;
  const chip = (axisId: string, val: string, text: string, on: boolean) =>
    `<button class="facet-chip${on ? " on" : ""}" data-axis-chip="${esc(axisId)}" data-val="${esc(val)}">${esc(text)}</button>`;

  const groupHtml = (a: FilterAxis): string => {
    const opts = a.optionsFrom(rows, ctx);
    const cur = sel(a.id);
    if (a.widget === "select") {
      const options = [`<option value="">All ${esc(a.label.toLowerCase())}</option>`]
        .concat(opts.map(o => `<option value="${esc(o.value)}"${cur[0] === o.value ? " selected" : ""}>${esc(o.label)}</option>`)).join("");
      return `<div class="facet-group" data-axis="${esc(a.id)}">${label(a.label)}<select class="facet-select" data-axis-select="${esc(a.id)}" aria-label="${esc(a.label)}">${options}</select></div>`;
    }
    return `<div class="facet-group" data-axis="${esc(a.id)}">${label(a.label)}`
      + opts.map(o => chip(a.id, o.value, o.label, cur.includes(o.value))).join("") + `</div>`;
  };

  // Active non-quick filters shown as removable chips in the bar.
  const activeExtra = extra.filter(a => sel(a.id).length);
  const extraChipsHtml = activeExtra.map(a =>
    `<div class="facet-group" data-axis="${esc(a.id)}">${label(a.label)}`
    + a.optionsFrom(rows, ctx).filter(o => sel(a.id).includes(o.value))
        .map(o => `<button class="facet-chip on" data-axis-chip="${esc(a.id)}" data-val="${esc(o.value)}">${esc(o.label)} ×</button>`).join("")
    + `</div>`).join("");

  const addFilterHtml = extra.length
    ? `<div class="facet-add"><button class="facet-chip" data-add-filter aria-haspopup="true">+ Filter</button>
        <div class="facet-pop" data-pop hidden>${extra.map(a => `<div class="pop-axis"><div class="pop-axis-label">${esc(a.label)}</div>`
        + a.optionsFrom(rows, ctx).map(o => `<label class="pop-opt"><input type="checkbox" data-pop-axis="${esc(a.id)}" data-pop-val="${esc(o.value)}"${sel(a.id).includes(o.value) ? " checked" : ""}/> ${esc(o.label)}</label>`).join("")
        + `</div>`).join("")}</div></div>`
    : "";

  const sortOpts = listSortKeys().filter(s => !s.appliesTo || s.appliesTo(ctx))
    .map(s => `<option value="${esc(s.id)}"${state.sort === s.id ? " selected" : ""}>${esc(s.label)}</option>`).join("");
  const sortHtml = `<div class="facet-group" data-axis="sort">${label("Sort")}<select class="facet-sort" aria-label="Sort">${sortOpts}</select></div>`;

  host.innerHTML = `<div class="facet-bar">${quick.map(groupHtml).join("")}${extraChipsHtml}${addFilterHtml}${sortHtml}</div>`
    + `<div class="facet-summary">${esc(summarize(artifact, state, applicable, ctx, rows.length))}</div>`;

  const emit = (mut: (s: FacetState) => FacetState) => {
    const clone: FacetState = { axes: {}, sort: state.sort };
    for (const [k, v] of Object.entries(state.axes)) clone.axes[k] = [...v];
    onChange(mut(clone));
  };
  const toggle = (s: FacetState, axisId: string, val: string, multi: boolean) => {
    const cur = s.axes[axisId] ?? [];
    if (!multi) { s.axes[axisId] = cur.includes(val) ? [] : [val]; return s; }
    s.axes[axisId] = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val];
    return s;
  };

  host.querySelectorAll<HTMLElement>("[data-axis-chip]").forEach(b =>
    b.addEventListener("click", () => emit(s => toggle(s, b.dataset.axisChip!, b.dataset.val!, true))));
  host.querySelectorAll<HTMLSelectElement>("[data-axis-select]").forEach(selEl =>
    selEl.addEventListener("change", () => emit(s => {
      const v = selEl.value; s.axes[selEl.dataset.axisSelect!] = v ? [v] : []; return s;
    })));
  host.querySelector<HTMLSelectElement>(".facet-sort")
    ?.addEventListener("change", e => emit(s => { s.sort = (e.target as HTMLSelectElement).value; return s; }));
  host.querySelectorAll<HTMLInputElement>("[data-pop-axis]").forEach(cb =>
    cb.addEventListener("change", () => emit(s => toggle(s, cb.dataset.popAxis!, cb.dataset.popVal!, true))));
  const addBtn = host.querySelector<HTMLElement>("[data-add-filter]");
  const pop = host.querySelector<HTMLElement>("[data-pop]");
  addBtn?.addEventListener("click", () => { if (pop) pop.hidden = !pop.hidden; });
}

// One-line read-only summary of active filters.
function summarize(artifact: Artifact, state: FacetState, applicable: FilterAxis[], _ctx: AxisCtx, count: number): string {
  const parts = [artifact.label];
  for (const a of applicable) {
    const v = state.axes[a.id];
    if (v && v.length) parts.push(`${a.label}: ${v.join(", ")}`);
  }
  return `${parts.join(" ▸ ")} · ${count} shown`;
}
