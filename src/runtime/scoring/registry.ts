import type { Kind, TriageItem } from "../dataset/item";
export type Scorer = (item: TriageItem) => number;
const scorers = new Map<Kind, Scorer>();
export function registerScorer(kind: Kind, s: Scorer) { scorers.set(kind, s); }
export function resolveScorer(kind: Kind, override?: Scorer): Scorer {
  return override ?? scorers.get(kind) ?? ((i) => i.signal);
}
