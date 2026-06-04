import type { Alert } from "../providers/registry";
import { defaultPriorityScore } from "../views/security-alerts/score";

export type Scorer = (a: Alert) => number;
export function resolveScorer(override?: Scorer): Scorer {
  return override ?? defaultPriorityScore;
}
