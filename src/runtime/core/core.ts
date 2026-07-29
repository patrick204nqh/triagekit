// src/runtime/core/core.ts
import type { Kind, TriageItem } from "../dataset/item";
import type { TriageFailure } from "../catalog/types";
import type { ScoreContext } from "../scoring/configured";
import type { ListState } from "../layout/toolbar/filter-state";
import { derive } from "./derivation";
import type { ViewPort } from "./ports";

export interface CoreDeps {
  items(): readonly TriageItem[];
  failures(): readonly TriageFailure[];
  refresh(): Promise<void>;
  view: ViewPort;
  activeKinds(): readonly Kind[];
  botLogins(): string[];
  scoreContext(): ScoreContext;
  filters(): ListState;
  repoView(): string;   // active repo display-filter ("" = all); not fetch-config Scope
}

export function createCore(deps: CoreDeps) {
  function paint(): void {
    const items = deps.items();
    const { scored, shown } = derive({
      items,
      activeKinds: deps.activeKinds(),
      botLogins: deps.botLogins(),
      score: deps.scoreContext(),
      repoView: deps.repoView(),
      filters: deps.filters(),
    });
    const byProvider: Record<string, number> = {};
    const byKind: Record<string, number> = {};
    for (const item of items) {
      byProvider[item.provider] = (byProvider[item.provider] ?? 0) + 1;
      byKind[item.kind] = (byKind[item.kind] ?? 0) + 1;
    }
    deps.view.render({
      scored,
      shown,
      errors: [...deps.failures()],
      stats: { byProvider, byKind },
    });
  }

  async function refreshNow(): Promise<void> {
    await deps.refresh();
    paint();
  }

  // Filter/scope/active-kind change: re-derive from the store, no refetch.
  function rerender(): void { paint(); }

  return { refreshNow, rerender };
}
export type Core = ReturnType<typeof createCore>;
