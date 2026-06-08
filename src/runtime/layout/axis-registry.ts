import type { ScoredItem } from "./table/kind-renderer";
import type { Artifact } from "../dataset/artifact";
import type { Tier } from "../scoring/tier";
import { authorKindOf, labelNamesOf } from "../dataset/details";
import { uniqueValues } from "./axis-utils";

export interface AxisCtx { artifact: Artifact; }
export interface AxisOption { value: string; label: string; }

// A declarative filter dimension. `quick` axes render inline in the bar; the rest
// live behind the "+ Filter" overflow. `widget` picks the inline control.
export interface FilterAxis {
  id: string;
  label: string;
  widget: "chips" | "select";
  quick: boolean;
  appliesTo(rows: ScoredItem[], ctx: AxisCtx): boolean;
  optionsFrom(rows: ScoredItem[], ctx: AxisCtx): AxisOption[];
  test(item: ScoredItem, selected: string[]): boolean;   // selected is non-empty
}

export interface SortKey {
  id: string;
  label: string;
  compare(a: ScoredItem, b: ScoredItem): number;
  appliesTo?(ctx: AxisCtx): boolean;   // omitted = always
}

const axes = new Map<string, FilterAxis>();
const sorts = new Map<string, SortKey>();
export function registerFilterAxis(a: FilterAxis): void { axes.set(a.id, a); }
export function registerSortKey(s: SortKey): void { sorts.set(s.id, s); }
export function getFilterAxis(id: string): FilterAxis | undefined { return axes.get(id); }
export function getSortKey(id: string): SortKey | undefined { return sorts.get(id); }
export function listFilterAxes(): FilterAxis[] { return [...axes.values()]; }
export function listSortKeys(): SortKey[] { return [...sorts.values()]; }

const TIERS: Tier[] = ["P0", "P1", "P2", "P3"];

// ── Built-in axes ──
registerFilterAxis({
  id: "tier", label: "Priority", widget: "chips", quick: true,
  appliesTo: (rows) => rows.length > 0,
  optionsFrom: () => TIERS.map(t => ({ value: t, label: t })),
  test: (i, sel) => sel.includes(i.tier),
});
registerFilterAxis({
  id: "author", label: "Author", widget: "chips", quick: true,
  appliesTo: (rows) => rows.length > 0 && rows.every(r => authorKindOf(r) !== undefined),
  optionsFrom: () => [{ value: "human", label: "Human" }, { value: "bot", label: "Bot" }],
  test: (i, sel) => { const k = authorKindOf(i); return k !== undefined && sel.includes(k); },
});

registerFilterAxis({
  id: "labels", label: "Labels", widget: "chips", quick: false,
  appliesTo: (rows) => rows.some(r => labelNamesOf(r).length > 0),
  optionsFrom: (rows) => uniqueValues(rows, labelNamesOf),
  test: (i, sel) => labelNamesOf(i).some(n => sel.includes(n)),
});

// ── Built-in sorts ──
registerSortKey({ id: "priority", label: "Priority", compare: (a, b) => b.score - a.score });
registerSortKey({ id: "recent", label: "Recent", compare: (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt) });
