import type { Kind, TriageItem } from "../dataset/item";

export type TriageAction =
  | {
    readonly intent: "merge";
    readonly itemId: string;
    readonly variant: "merge" | "squash" | "rebase";
  }
  | {
    readonly intent: "comment";
    readonly itemId: string;
    readonly markdown: string;
  }
  | {
    readonly intent: "label";
    readonly itemId: string;
    readonly labels: readonly string[];
  }
  | {
    readonly intent: "assign";
    readonly itemId: string;
    readonly assignees: readonly string[];
  }
  | {
    readonly intent: "close";
    readonly itemId: string;
  };

export interface ActionAvailability {
  readonly intent: TriageAction["intent"];
  readonly variants?: readonly string[];
}

export type ActionResult =
  | { readonly status: "confirmed"; readonly item?: TriageItem }
  | { readonly status: "rejected"; readonly message: string }
  | { readonly status: "outcome-unknown"; readonly message: string };

export interface ActionDefinition<
  A extends TriageAction = TriageAction,
> {
  readonly intent: A["intent"];
  readonly kinds: readonly Kind[];
  readonly variants?: readonly string[];
  available(item: TriageItem): boolean;
  validate(action: A): readonly string[];
  execute(
    action: A,
    item: TriageItem,
    signal: AbortSignal,
  ): Promise<ActionResult>;
  revalidate(action: A, item: TriageItem): {
    readonly targets: readonly string[];
    readonly kinds: readonly Kind[];
  };
}

export interface ActionCatalog {
  readonly definitions: readonly ActionDefinition[];
  forItem(item: TriageItem): readonly ActionAvailability[];
  definition(
    intent: TriageAction["intent"],
  ): ActionDefinition | undefined;
}
