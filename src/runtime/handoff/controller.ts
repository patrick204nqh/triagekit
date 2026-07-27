import type { AgentHandoffV1, HandoffIntent, TransportResult } from "./types";
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
  private currentIntent: HandoffIntent | null = null;
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
    this.currentIntent = null;

    const handoff = this.buildHandoff(item, explanation, session);
    this.currentHandoff = handoff;
    this.currentIntent = { ...handoff.intent };

    const result = validate(handoff);
    if (!result.valid) {
      this.surface.open(handoff, this.makeCallbacks());
      this.surface.showStatus("Validation errors — transport disabled");
      return;
    }

    this.surface.open(handoff, this.makeCallbacks(), this.deps.returnFocus);
  }

  private buildHandoff(
    item: ScoredItem,
    explanation: ScoreExplanation | null,
    session: SessionState,
  ): AgentHandoffV1 {
    return project({
      item,
      explanation,
      session,
      intent: this.currentIntent ?? undefined,
      catalog: this.deps.catalog,
    });
  }

  private makeCallbacks() {
    return {
      onOutcomeChange: (value: string) => {
        if (!this.currentIntent) return;
        this.currentIntent = { ...this.currentIntent, outcome: value };
        this.rebuild();
      },
      onConstraintChange: (index: number, value: string) => {
        if (!this.currentIntent) return;
        const next = [...this.currentIntent.constraints];
        next[index] = value;
        this.currentIntent = { ...this.currentIntent, constraints: next };
        this.rebuild();
      },
      onVerificationChange: (index: number, value: string) => {
        if (!this.currentIntent) return;
        const next = [...this.currentIntent.verification];
        next[index] = value;
        this.currentIntent = { ...this.currentIntent, verification: next };
        this.rebuild();
      },
      onCopy: async () => {
        if (!this.currentHandoff) return;
        const md = renderMarkdown(this.currentHandoff);
        const result = await copyMarkdown(md);
        this.surface.showStatus(result.ok ? "Copied to clipboard" : result.error);
      },
      onDownloadMarkdown: () => {
        if (!this.currentHandoff) return;
        const md = renderMarkdown(this.currentHandoff);
        const result = downloadMarkdown(this.currentHandoff, md);
        if (!result.ok) this.surface.showStatus(result.error);
      },
      onDownloadJSON: () => {
        if (!this.currentHandoff) return;
        const result = downloadJSON(this.currentHandoff);
        if (!result.ok) this.surface.showStatus(result.error);
      },
      onClose: () => {
        this.surface.close();
        this.currentHandoff = null;
        this.currentIntent = null;
        this.currentItem = null;
      },
    };
  }

  private rebuild(): void {
    if (!this.currentItem || !this.currentIntent) return;
    const explanation = this.deps.scoreExplain(this.currentItem);
    const session = this.deps.session();
    this.currentHandoff = this.buildHandoff(this.currentItem, explanation, session);
    const result = validate(this.currentHandoff);
    this.surface.open(this.currentHandoff, this.makeCallbacks(), this.deps.returnFocus);
    if (!result.valid) {
      this.surface.showStatus("Validation errors — transport disabled");
    }
  }
}
