// src/runtime/core/core.ts
import type { Kind } from "../dataset/item";
import type { TriageFailure } from "../catalog/types";
import type { ScoreContext } from "../scoring/configured";
import type { ListState } from "../layout/toolbar/filter-state";
import { derive } from "./derivation";
import {
  refreshProviders,
  type ProviderRefreshJob,
} from "./orchestrator";
import type { DatasetStore } from "./store";
import type { ViewPort } from "./ports";

export interface CoreDeps {
  store: DatasetStore;
  view: ViewPort;
  jobsFor(): ProviderRefreshJob[];
  activeKinds(): Kind[];
  botLogins(): string[];
  scoreContext(): ScoreContext;
  filters(): ListState;
  repoView(): string;   // active repo display-filter ("" = all); not fetch-config Scope
}

export function createCore(deps: CoreDeps) {
  let lastErrors: TriageFailure[] = [];

  function paint(): void {
    const { scored, shown } = derive({
      items: deps.store.snapshot(),
      activeKinds: deps.activeKinds(),
      botLogins: deps.botLogins(),
      score: deps.scoreContext(),
      repoView: deps.repoView(),
      filters: deps.filters(),
    });
    deps.view.render({ scored, shown, errors: lastErrors, stats: deps.store.stats() });
  }

  async function refreshNow(): Promise<void> {
    const { failures } = await refreshProviders(deps.jobsFor(), deps.store);
    lastErrors = failures;
    paint();
  }

  // Filter/scope/active-kind change: re-derive from the store, no refetch.
  function rerender(): void { paint(); }

  return { refreshNow, rerender };
}
export type Core = ReturnType<typeof createCore>;
