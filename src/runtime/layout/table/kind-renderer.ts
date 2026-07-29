import type { Kind, TriageItem } from "../../dataset/item";
import type { TriageFailure } from "../../catalog/types";
import type {
  ActionAvailability,
  ActionResult,
  TriageAction,
} from "../../actions/types";
import type { Tier } from "../../scoring/tier";
import type { ScoreExplanation } from "../../scoring/score-model";
import type { DetailView } from "./detail-view";
import type { HandoffController } from "../../handoff/controller";
import { esc } from "../util";
import type { RowDelegationSelection } from "../delegation/selection-controls";

export interface ScoredItem extends TriageItem { score: number; tier: Tier; }
export interface TriageActionPort {
  available(item: TriageItem): readonly ActionAvailability[];
  perform(action: TriageAction): Promise<ActionResult>;
  status?(): {
    readonly paused: boolean;
    readonly retryAt?: number;
  };
}

export interface DetailCtx {
  actions?: TriageActionPort;
  onChange?: (i: ScoredItem) => void;
  scoreExplain?: (i: ScoredItem) => ScoreExplanation | null;   // null = built-in path (no per-signal breakdown)
  handoffController?: HandoffController;
  delegationSelection?: RowDelegationSelection;
}
export interface KindRenderer {
  kind: Kind;
  columns?: { header: string; cell: (i: ScoredItem) => string }[];
  detail?: (i: ScoredItem, ctx: DetailCtx) => DetailView;
}
export function warningsHtml(errors: TriageFailure[]): string {
  if (!errors.length) return "";
  const items = errors.map(e => {
    const target = e.target ?? e.kind ?? e.provider;
    return `<li>${esc(target)}: ${esc(e.message)}</li>`;
  }).join("");
  const noun = errors.length === 1 ? "target" : "targets";
  return `<div class="warnings"><strong>${errors.length} ${noun} couldn't be loaded</strong><ul>${items}</ul></div>`;
}
