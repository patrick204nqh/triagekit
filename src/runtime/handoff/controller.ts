import type { AgentHandoffV1 } from "./types";
import type { ScoredItem } from "../layout/table/kind-renderer";
import type { SessionState } from "../session/types";
import type { ScoreExplanation } from "../scoring/score-model";
import type { RuntimeCatalog } from "../catalog/types";
import { project } from "./projector";
import { renderMarkdown } from "./markdown";
import { copyMarkdown } from "./adapters/clipboard";
import { downloadMarkdown, downloadJSON } from "./adapters/download";

export interface HandoffControllerDeps {
  session(): SessionState;
  scoreExplain(item: ScoredItem): ScoreExplanation | null;
  catalog: RuntimeCatalog;
}

export class HandoffController {
  constructor(private deps: HandoffControllerDeps) {}

  generateFor(item: ScoredItem): AgentHandoffV1 {
    return project({
      item,
      explanation: this.deps.scoreExplain(item),
      session: this.deps.session(),
      catalog: this.deps.catalog,
    });
  }

  async copy(handoff: AgentHandoffV1): Promise<string | null> {
    const md = renderMarkdown(handoff);
    const r = await copyMarkdown(md);
    return r.ok ? null : r.error;
  }

  downloadMD(handoff: AgentHandoffV1): string | null {
    const r = downloadMarkdown(handoff, renderMarkdown(handoff));
    return r.ok ? null : r.error;
  }

  downloadJSON(handoff: AgentHandoffV1): string | null {
    const r = downloadJSON(handoff);
    return r.ok ? null : r.error;
  }
}
