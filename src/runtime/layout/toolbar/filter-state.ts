import type { ScoredItem } from "../table/kind-renderer";
import { getFilterAxis, getSortKey, type AxisCtx } from "./axis-registry";

// Pure filter+sort state for a triage list. WHERE (provider) is handled outside
// this type — at the fetch level in app-shell — not as an axis here.
export interface ListState {
  axes: Record<string, string[]>;   // axisId -> selected values (empty/absent = all)
  sort: string;                     // sort-key id
}

export function emptyListState(): ListState {
  return { axes: {}, sort: "priority" };
}

export function applyFilters(rows: ScoredItem[], state: ListState): ScoredItem[] {
  let out = rows;
  for (const [axisId, vals] of Object.entries(state.axes)) {
    if (!vals || !vals.length) continue;
    const axis = getFilterAxis(axisId);
    if (axis) out = out.filter(i => axis.test(i, vals));
  }
  const sk = getSortKey(state.sort) ?? getSortKey("priority")!;
  return [...out].sort(sk.compare);
}

// Drop selected axis values that are no longer valid options for `rows` — e.g. a
// label that doesn't exist in the repo just switched to. An axis left with no valid
// selection is removed entirely so its stale "· N" count never lingers and the
// table doesn't silently filter to empty against an option the user can't see to
// un-check. Row-independent axes (tier/author) keep their selections, since their
// option set is fixed regardless of the visible rows.
export function pruneFilters(state: ListState, rows: ScoredItem[], ctx: AxisCtx): ListState {
  const axes: Record<string, string[]> = {};
  for (const [id, vals] of Object.entries(state.axes)) {
    if (!vals?.length) continue;
    const axis = getFilterAxis(id);
    if (!axis) continue;
    const valid = new Set(axis.optionsFrom(rows, ctx).map(o => o.value));
    const kept = vals.filter(v => valid.has(v));
    if (kept.length) axes[id] = kept;
  }
  return { axes, sort: state.sort };
}
