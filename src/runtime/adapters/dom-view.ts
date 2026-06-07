// src/runtime/adapters/dom-view.ts
import type { ViewPort } from "../core/ports";
import type { ViewModel } from "../core/view-model";
import type { Artifact } from "../dataset/artifact";
import type { FacetState } from "../layout/facet-bar";
import type { ScoredItem } from "../layout/triage-table";
import type { ScoreExplanation } from "../scoring/score-model";
import { emptyFacetState, renderFacetBar } from "../layout/facet-bar";
import { renderTriageList } from "../layout/triage-table";

export interface DomViewDeps {
  artifact: Artifact;
  onFacetChange(next: FacetState): void;     // driving adapter updates state + calls core.rerender
  facets?: () => FacetState;                  // current facet state to draw the bar from
  token: string;
  scoreExplain(i: ScoredItem): ScoreExplanation | null;
}

// Mirrors app-shell.ts renderListWithFacets. Paints facet bar (over vm.scored) + list (vm.shown).
export function createDomView(host: HTMLElement, deps: DomViewDeps): ViewPort {
  return {
    render(vm: ViewModel) {
      host.innerHTML = `<div class="facet-host"></div><div class="surface-body"></div>`;
      const facetHost = host.querySelector<HTMLElement>(".facet-host")!;
      const body = host.querySelector<HTMLElement>(".surface-body")!;
      const state = deps.facets?.() ?? emptyFacetState();
      renderFacetBar(facetHost, deps.artifact, vm.scored, state, deps.onFacetChange);
      renderTriageList(body, vm.shown, vm.errors, { token: deps.token, scoreExplain: deps.scoreExplain });
    },
  };
}
