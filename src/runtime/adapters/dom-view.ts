// src/runtime/adapters/dom-view.ts
import type { ViewPort } from "../core/ports";
import type { ViewModel } from "../core/view-model";
import type { Artifact } from "../dataset/artifact";
import type { ScoredItem } from "../layout/table/kind-renderer";
import type { ScoreExplanation } from "../scoring/score-model";
import type { RuntimeCatalog } from "../catalog/types";
import type { TriageActionPort } from "../layout/table/kind-renderer";
import { renderTriageList } from "../layout/table/detail-panel";
import type {
  HandoffSelection,
} from "../layout/handoff/selection-controls";

export interface DomViewDeps {
  artifact: Artifact;
  scoreExplain(i: ScoredItem): ScoreExplanation | null;
  catalog?: RuntimeCatalog;
  actions?: TriageActionPort;
  handoffSelection?: HandoffSelection;
}

// Render-only list surface. Filtering/sorting is driven by the unified toolbar
// (mounted in the shell's nav) via onFilterChange; this adapter just paints the
// already-derived rows.
export function createDomView(host: HTMLElement, deps: DomViewDeps): ViewPort {
  let activeDetailItemId: string | null = null;
  let teardownList = () => {};

  return {
    render(vm: ViewModel) {
      teardownList();
      host.innerHTML = `<div class="surface-body"></div>`;
      const body = host.querySelector<HTMLElement>(".surface-body")!;
      teardownList = renderTriageList(
        body,
        vm.shown,
        vm.errors,
        {
          actions: deps.actions,
          scoreExplain: deps.scoreExplain,
          handoffSelection: deps.handoffSelection,
        },
        deps.catalog,
        {
          activeItemId: activeDetailItemId,
          onActiveItemChange: (itemId) => {
            activeDetailItemId = itemId;
          },
        },
      );
    },
  };
}
