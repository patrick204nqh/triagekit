// src/runtime/adapters/dom-view.ts
import type { ViewPort } from "../core/ports";
import type { ViewModel } from "../core/view-model";
import type { Artifact } from "../dataset/artifact";
import type { ScoredItem } from "../layout/table/kind-renderer";
import type { ScoreExplanation } from "../scoring/score-model";
import type { RuntimeCatalog } from "../catalog/types";
import type { Kind } from "../dataset/item";
import type { ProviderDetailPort } from "../layout/table/kind-renderer";
import type { HandoffController } from "../handoff/controller";
import { renderTriageList } from "../layout/table/detail-panel";

export interface DomViewDeps {
  artifact: Artifact;
  token: string;
  providerId?: string;
  scoreExplain(i: ScoredItem): ScoreExplanation | null;
  catalog?: RuntimeCatalog;
  handoffController?: HandoffController;
}

// Render-only list surface. Filtering/sorting is driven by the unified toolbar
// (mounted in the shell's nav) via onFilterChange; this adapter just paints the
// already-derived rows.
export function createDomView(host: HTMLElement, deps: DomViewDeps): ViewPort {
  const declarationFor = (kind: Kind) => deps.catalog
    ?.providersFor(kind)
    .find((provider) =>
      provider.id === deps.providerId
      || (!deps.providerId && provider.status === "ready"));
  const providerDetail: ProviderDetailPort | undefined = deps.catalog
    ? {
      supports(kind, action) {
        return declarationFor(kind)?.capabilities.actions[kind]
          ?.includes(action) ?? false;
      },
      async enrich(kind, ref) {
        const provider = declarationFor(kind);
        if (!provider?.adapter?.enrich) {
          throw new Error(`no Provider enrichment for "${kind}"`);
        }
        return provider.adapter.enrich(kind, ref, deps.token);
      },
      async execute(command) {
        const provider = declarationFor(command.kind);
        if (!provider?.adapter?.execute) {
          throw new Error(`no Provider action adapter for "${command.kind}"`);
        }
        await provider.adapter.execute(command, deps.token);
      },
    }
    : undefined;
  return {
    render(vm: ViewModel) {
      host.innerHTML = `<div class="surface-body"></div>`;
      const body = host.querySelector<HTMLElement>(".surface-body")!;
      renderTriageList(
        body,
        vm.shown,
        vm.errors,
        { provider: providerDetail, scoreExplain: deps.scoreExplain, handoffController: deps.handoffController },
        deps.catalog,
      );
    },
  };
}
