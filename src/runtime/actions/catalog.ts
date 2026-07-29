import type {
  ActionCatalog,
  ActionDefinition,
  ActionAvailability,
  TriageAction,
} from "./types";
import type { TriageItem } from "../dataset/item";

const freezeDefinition = (
  definition: ActionDefinition,
): ActionDefinition => Object.freeze({
  ...definition,
  kinds: Object.freeze([...definition.kinds]),
  ...(definition.variants
    ? { variants: Object.freeze([...definition.variants]) }
    : {}),
});

export const createActionCatalog = (
  definitions: readonly ActionDefinition[],
): ActionCatalog => {
  const byIntent = new Map<
    ActionDefinition["intent"],
    ActionDefinition
  >();

  for (const candidate of definitions) {
    if (byIntent.has(candidate.intent)) {
      throw new Error(`Duplicate Triage Action definition for "${candidate.intent}"`);
    }
    if (candidate.kinds.length === 0) {
      throw new Error(
        `Triage Action "${candidate.intent}" must support at least one Kind`,
      );
    }
    byIntent.set(candidate.intent, freezeDefinition(candidate));
  }

  const frozenDefinitions = Object.freeze([...byIntent.values()]);
  return Object.freeze({
    definitions: frozenDefinitions,
    forItem(item: TriageItem) {
      const availability: ActionAvailability[] = [];
      for (const definition of frozenDefinitions) {
        if (!definition.kinds.includes(item.kind)
          || !definition.available(item)) continue;
        availability.push(Object.freeze({
          intent: definition.intent,
          ...(definition.variants
            ? { variants: definition.variants }
            : {}),
        }));
      }
      return Object.freeze(availability);
    },
    definition(intent: TriageAction["intent"]) {
      return byIntent.get(intent);
    },
  });
};
