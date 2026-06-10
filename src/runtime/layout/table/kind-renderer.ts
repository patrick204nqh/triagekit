import type { Kind, TriageItem } from "../../dataset/item";
import type { TriageError } from "../../ingest/source";
import type { Tier } from "../../scoring/tier";
import type { ScoreExplanation } from "../../scoring/score-model";
import type { DetailView } from "./detail-view";
import { esc } from "../util";

export interface ScoredItem extends TriageItem { score: number; tier: Tier; }
export interface DetailCtx {
  token?: string;
  onChange?: (i: ScoredItem) => void;
  scoreExplain?: (i: ScoredItem) => ScoreExplanation | null;   // null = built-in path (no per-signal breakdown)
}
export interface KindRenderer {
  kind: Kind;
  columns?: { header: string; cell: (i: ScoredItem) => string }[];
  detail?: (i: ScoredItem, ctx: DetailCtx) => DetailView;
}
export const renderers = new Map<Kind, KindRenderer>();
export function registerKindRenderer(r: KindRenderer) { renderers.set(r.kind, r); }

export function warningsHtml(errors: TriageError[]): string {
  if (!errors.length) return "";
  const items = errors.map(e => `<li>${esc(e.target)}: ${esc(e.message)}</li>`).join("");
  const noun = errors.length === 1 ? "target" : "targets";
  return `<div class="warnings"><strong>${errors.length} ${noun} couldn't be loaded</strong><ul>${items}</ul></div>`;
}
