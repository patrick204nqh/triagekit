import type { Kind } from "../dataset/item";
import type { ScoreModel } from "./score-model";

// Adapter-published default ScoreModel per kind. Used ONLY to seed the Settings
// scoring editor and as the Reset-to-default target — never by scoreAndTier.
const defaults = new Map<Kind, ScoreModel>();

export function registerDefaultModel(kind: Kind, model: ScoreModel): void {
  defaults.set(kind, model);
}
export function defaultModelFor(kind: Kind): ScoreModel | null {
  return defaults.get(kind) ?? null;
}
export function listDefaultModels(): Array<[Kind, ScoreModel]> {
  return [...defaults.entries()];
}
export function _resetDefaultModels(): void {
  defaults.clear();
}
