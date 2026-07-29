import type { ScoredItem } from "../table/kind-renderer";
import { runtimeCatalog } from "../../catalog/built-in";
import type { RuntimeCatalog } from "../../catalog/types";
import type { AxisCtx } from "./axis-registry";
import type { FocusPolicySnapshot } from "../../focus/types";
import { matchesLabelRules } from "../../focus/policy";

// Pure filter+sort state for a triage list. WHERE (provider) is handled outside
// this type — at the fetch level in app-shell — not as an axis here.
export interface ListState {
  axes: Record<string, string[]>;   // axisId -> selected values (empty/absent = all)
  sort: string;                     // sort-key id
}

export function emptyListState(): ListState {
  return { axes: {}, sort: "priority" };
}

export function applyFilters(
  rows: ScoredItem[],
  state: ListState,
  catalog: RuntimeCatalog = runtimeCatalog,
  focusPolicy?: FocusPolicySnapshot,
): ScoredItem[] {
  let out = rows;
  for (const [axisId, vals] of Object.entries(state.axes)) {
    if (focusPolicy && axisId === "labels") continue;
    if (!vals || !vals.length) continue;
    const axis = catalog.filter(axisId);
    if (axis) out = out.filter(i => axis.test(i, vals));
  }
  if (focusPolicy) {
    const labels = catalog.filter("labels");
    out = out.filter((item) => matchesLabelRules(
      [
        ...focusPolicy.labels.include,
        ...focusPolicy.labels.exclude,
      ].filter((label) => labels?.test(item, [label])),
      focusPolicy.labels,
    ));
  }
  const sk = catalog.sort(state.sort) ?? catalog.sort("priority")!;
  if (!focusPolicy) return [...out].sort(sk.compare);
  const ranks = new Map(
    focusPolicy.repositoryOrder.map((repository, index) => [
      repository,
      index,
    ]),
  );
  return [...out].sort((left, right) => {
    const leftRank = ranks.get(left.location) ?? ranks.size;
    const rightRank = ranks.get(right.location) ?? ranks.size;
    return leftRank - rightRank
      || (leftRank === ranks.size && rightRank === ranks.size
        ? left.location.localeCompare(right.location)
        : 0)
      || sk.compare(left, right)
      || left.id.localeCompare(right.id);
  });
}

// Drop selected axis values that are no longer valid options for `rows` — e.g. a
// label that doesn't exist in the repo just switched to. An axis left with no valid
// selection is removed entirely so its stale "· N" count never lingers and the
// table doesn't silently filter to empty against an option the user can't see to
// un-check. Row-independent axes (tier/author) keep their selections, since their
// option set is fixed regardless of the visible rows.
export function pruneFilters(
  state: ListState,
  rows: ScoredItem[],
  ctx: AxisCtx,
  catalog: RuntimeCatalog = runtimeCatalog,
): ListState {
  const axes: Record<string, string[]> = {};
  for (const [id, vals] of Object.entries(state.axes)) {
    if (!vals?.length) continue;
    const axis = catalog.filter(id);
    if (!axis) continue;
    const valid = new Set(axis.optionsFrom(rows, ctx).map(o => o.value));
    const kept = vals.filter(v => valid.has(v));
    if (kept.length) axes[id] = kept;
  }
  return { axes, sort: state.sort };
}
