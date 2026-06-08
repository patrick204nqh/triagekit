// src/runtime/adapters/dom-view.ts
import type { ViewPort } from "../core/ports";
import type { ViewModel } from "../core/view-model";
import type { Artifact } from "../dataset/artifact";
import type { ScoredItem } from "../layout/triage-table";
import type { ScoreExplanation } from "../scoring/score-model";
import { renderTriageList } from "../layout/triage-table";

export interface DomViewDeps {
  artifact: Artifact;
  token: string;
  scoreExplain(i: ScoredItem): ScoreExplanation | null;
}

// Render-only list surface. Filtering/sorting is driven by the unified toolbar
// (mounted in the shell's nav) via onFilterChange; this adapter just paints the
// already-derived rows.
export function createDomView(host: HTMLElement, deps: DomViewDeps): ViewPort {
  return {
    render(vm: ViewModel) {
      host.innerHTML = `<div class="surface-body"></div>`;
      const body = host.querySelector<HTMLElement>(".surface-body")!;
      renderTriageList(body, vm.shown, vm.errors, { token: deps.token, scoreExplain: deps.scoreExplain });
    },
  };
}
