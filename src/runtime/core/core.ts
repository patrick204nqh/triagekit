// src/runtime/core/core.ts
import type { Kind } from "../dataset/item";
import type { TriageError } from "../ingest/source";
import type { ScoreContext } from "../scoring/configured";
import type { ListState } from "../layout/filter-state";
import { derive } from "./derivation";
import { refresh, type ProviderJob } from "./orchestrator";
import type { DatasetStore } from "./store";
import type { ViewPort } from "./ports";

export interface CoreDeps {
  store: DatasetStore;
  view: ViewPort;
  jobsFor(): ProviderJob[];        // current provider jobs (scope/cred resolved by the driving adapter)
  activeKinds(): Kind[];
  botLogins(): string[];
  scoreContext(): ScoreContext;
  facets(): ListState;
}

export function createCore(deps: CoreDeps) {
  let lastErrors: TriageError[] = [];

  function paint(): void {
    const { scored, shown } = derive({
      items: deps.store.snapshot(),
      activeKinds: deps.activeKinds(),
      botLogins: deps.botLogins(),
      score: deps.scoreContext(),
      facets: deps.facets(),
    });
    deps.view.render({ scored, shown, errors: lastErrors, stats: deps.store.stats() });
  }

  async function refreshNow(): Promise<void> {
    const { errors } = await refresh(deps.jobsFor(), deps.store);
    lastErrors = errors;
    paint();
  }

  // Facet/scope/active-kind change: re-derive from the store, no refetch.
  function rerender(): void { paint(); }

  return { refreshNow, rerender };
}
export type Core = ReturnType<typeof createCore>;
