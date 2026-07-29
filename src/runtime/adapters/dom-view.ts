// src/runtime/adapters/dom-view.ts
import type { ViewPort } from "../core/ports";
import type { ViewModel } from "../core/view-model";
import type { Artifact } from "../dataset/artifact";
import type { ScoredItem } from "../layout/table/kind-renderer";
import type { ScoreExplanation } from "../scoring/score-model";
import type { RuntimeCatalog } from "../catalog/types";
import type { TriageActionPort } from "../layout/table/kind-renderer";
import type { HandoffController } from "../handoff/controller";
import { renderTriageList } from "../layout/table/detail-panel";
import type {
  RowDelegationSelection,
} from "../layout/delegation/selection-controls";

export interface DomViewDeps {
  artifact: Artifact;
  scoreExplain(i: ScoredItem): ScoreExplanation | null;
  catalog?: RuntimeCatalog;
  handoffController?: HandoffController;
  actions?: TriageActionPort;
  delegationSelection?: RowDelegationSelection;
}

// Render-only list surface. Filtering/sorting is driven by the unified toolbar
// (mounted in the shell's nav) via onFilterChange; this adapter just paints the
// already-derived rows.
export function createDomView(host: HTMLElement, deps: DomViewDeps): ViewPort {
  return {
    render(vm: ViewModel) {
      host.innerHTML = `<div class="surface-body"></div>`;
      const body = host.querySelector<HTMLElement>(".surface-body")!;
      renderTriageList(
        body,
        vm.shown,
        vm.errors,
        {
          actions: deps.actions,
          scoreExplain: deps.scoreExplain,
          handoffController: deps.handoffController,
          delegationSelection: deps.delegationSelection,
        },
        deps.catalog,
      );
    },
  };
}
