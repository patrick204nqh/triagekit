import type { AgentHandoffV1 } from "./types";
import type { ScoredItem } from "../layout/table/kind-renderer";
import type { ScoreExplanation } from "../scoring/score-model";
import type { SessionState } from "../session/types";
import type { RuntimeCatalog } from "../catalog/types";
import { project } from "./projector";
import { validate } from "./validator";
import { renderMarkdown } from "./markdown";
import { copyMarkdown } from "./adapters/clipboard";
import { downloadMarkdown, downloadJSON } from "./adapters/download";
import { BriefSurface } from "./brief-surface";

export interface HandoffControllerDeps {
  session(): SessionState;
  scoreExplain(item: ScoredItem): ScoreExplanation | null;
  catalog: RuntimeCatalog;
  container: HTMLElement;
  returnFocus?: HTMLElement;
}

export class HandoffController {
  private deps: HandoffControllerDeps;
  private surface: BriefSurface;
  private currentHandoff: AgentHandoffV1 | null = null;
  private currentItem: ScoredItem | null = null;

  constructor(deps: HandoffControllerDeps) {
    this.deps = deps;
    this.surface = new BriefSurface();
    this.surface.mount(deps.container);
  }

  openFor(item: ScoredItem): void {
    this.currentItem = item;
    const explanation = this.deps.scoreExplain(item);
    const session = this.deps.session();

    const handoff = project({
      item,
      explanation,
      session,
      catalog: this.deps.catalog,
    });
    this.currentHandoff = handoff;

    const result = validate(handoff);
    const callbacks = this.makeCallbacks();
    this.surface.open(handoff, callbacks, this.deps.returnFocus);
    if (!result.valid) {
      this.surface.showStatus("Validation errors — transport disabled");
    }
  }

  private makeCallbacks() {
    return {
      onCopy: async () => {
        if (!this.currentHandoff) return;
        const md = renderMarkdown(this.currentHandoff);
        const r = await copyMarkdown(md);
        this.surface.showStatus(r.ok ? "Copied to clipboard" : r.error);
      },
      onDownloadMarkdown: () => {
        if (!this.currentHandoff) return;
        const md = renderMarkdown(this.currentHandoff);
        const r = downloadMarkdown(this.currentHandoff, md);
        if (!r.ok) this.surface.showStatus(r.error);
      },
      onDownloadJSON: () => {
        if (!this.currentHandoff) return;
        const r = downloadJSON(this.currentHandoff);
        if (!r.ok) this.surface.showStatus(r.error);
      },
      onClose: () => {
        this.surface.close();
        this.currentHandoff = null;
        this.currentItem = null;
      },
    };
  }
}
