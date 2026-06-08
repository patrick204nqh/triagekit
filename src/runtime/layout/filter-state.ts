import type { ScoredItem } from "./table/kind-renderer";
import { getFilterAxis, getSortKey } from "./axis-registry";

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
