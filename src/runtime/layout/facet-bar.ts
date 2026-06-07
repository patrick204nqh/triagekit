import type { ScoredItem } from "./triage-table";
import { getFilterAxis, getSortKey } from "./facet-registry";

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
