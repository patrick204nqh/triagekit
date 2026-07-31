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
import { esc } from "../util";
import type { HandoffSelection } from "../delegation/selection-controls";

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
  handoffSelection?: HandoffSelection;
}
export interface KindRenderer {
  kind: Kind;
  columns?: { header: string; cell: (i: ScoredItem) => string }[];
  detail?: (i: ScoredItem, ctx: DetailCtx) => DetailView;
}
export function warningsHtml(
  errors: readonly TriageFailure[],
  surfaceLabel: string,
): string {
  if (!errors.length) return "";
  const grouped = new Map<string, Set<string>>();
  for (const error of errors) {
    const repositories = grouped.get(error.message) ?? new Set<string>();
    repositories.add(error.target ?? error.kind ?? error.provider);
    grouped.set(error.message, repositories);
  }
  const repositories = new Set(
    [...grouped.values()].flatMap((targets) => [...targets]),
  );
  const noun = repositories.size === 1 ? "repository" : "repositories";
  const causes = [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([message, targets]) =>
      `<li data-warning-cause><span>${esc(message)}</span><ul>${
        [...targets]
          .sort((left, right) => left.localeCompare(right))
          .map((target) =>
            `<li data-warning-repository>${esc(target)}</li>`)
          .join("")
      }</ul></li>`)
    .join("");
  return `<details class="warnings"><summary><strong>${esc(surfaceLabel)} unavailable in ${repositories.size} ${noun}</strong><span class="warning-show">Show details</span><span class="warning-hide">Hide details</span></summary><ul class="warning-causes">${causes}</ul></details>`;
}
