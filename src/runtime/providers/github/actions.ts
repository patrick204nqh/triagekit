import type {
  ActionDefinition,
  ActionResult,
  TriageAction,
} from "../../actions/types";
import { ProviderError } from "../../core/errors";
import type { Kind, TriageItem } from "../../dataset/item";
import type { GithubHttp } from "./http";
import { GithubOutcomeUnknownError } from "./scheduler";

interface GithubReference {
  readonly repository: string;
  readonly number: number;
}

const reference = (item: TriageItem): GithubReference => {
  if (item.provider !== "github"
    || !item.providerRef
    || typeof item.providerRef !== "object") {
    throw new ProviderError(
      "github",
      "reference",
      "expected a GitHub Provider Reference",
    );
  }
  const candidate = item.providerRef as Partial<GithubReference>;
  if (typeof candidate.repository !== "string"
    || candidate.repository.length === 0
    || typeof candidate.number !== "number"
    || !Number.isFinite(candidate.number)) {
    throw new ProviderError(
      "github",
      "reference",
      "expected repository and issue number",
    );
  }
  return {
    repository: candidate.repository,
    number: candidate.number,
  };
};

const state = (item: TriageItem): string | undefined => {
  if (!item.details || typeof item.details !== "object") return undefined;
  const value = (item.details as { state?: unknown }).state;
  return typeof value === "string" ? value : undefined;
};

const withState = (item: TriageItem, nextState: string): TriageItem => ({
  ...item,
  details: {
    ...(item.details && typeof item.details === "object"
      ? item.details
      : {}),
    state: nextState,
  },
});

const validation = (
  action: TriageAction,
  validateInput?: () => readonly string[],
): readonly string[] => {
  const errors: string[] = [];
  if (action.itemId.trim().length === 0) errors.push("itemId is required");
  errors.push(...(validateInput?.() ?? []));
  return errors;
};

const selection = (_action: TriageAction, item: TriageItem) => ({
  targets: [reference(item).repository],
  kinds: [item.kind],
});

const execute = async (input: {
  readonly http?: GithubHttp;
  readonly path: string;
  readonly method: string;
  readonly body: object;
  readonly signal: AbortSignal;
  readonly confirmedItem?: TriageItem;
}): Promise<ActionResult> => {
  if (!input.http) {
    return { status: "rejected", message: "Provider Connection is not bound" };
  }
  try {
    await input.http.request<unknown>(input.path, {
      priority: "triage-action",
      retry: "never",
      signal: input.signal,
      init: {
        method: input.method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input.body),
      },
    });
    return {
      status: "confirmed",
      ...(input.confirmedItem ? { item: input.confirmedItem } : {}),
    };
  } catch (error) {
    if (input.signal.aborted) {
      throw input.signal.reason ?? error;
    }
    if (error instanceof GithubOutcomeUnknownError) {
      return { status: "outcome-unknown", message: error.message };
    }
    return {
      status: "rejected",
      message: error instanceof Error ? error.message : String(error),
    };
  }
};

export const createGithubActionDefinitions = (
  http?: GithubHttp,
): readonly ActionDefinition[] => [
  {
    intent: "merge",
    kinds: ["change-request"],
    variants: ["merge", "squash", "rebase"],
    available: (item) => state(item) === "open",
    validate: (action) => validation(
      action,
      () => action.intent === "merge"
        && ["merge", "squash", "rebase"].includes(action.variant)
        ? []
        : ["merge variant is invalid"],
    ),
    async execute(action, item, signal) {
      if (action.intent !== "merge") {
        return { status: "rejected", message: "Expected merge action" };
      }
      try {
        const ref = reference(item);
        return execute({
          http,
          path: `/repos/${ref.repository}/pulls/${ref.number}/merge`,
          method: "PUT",
          body: { merge_method: action.variant },
          signal,
          confirmedItem: withState(item, "merged"),
        });
      } catch (error) {
        return {
          status: "rejected",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
    revalidate: selection,
  },
  {
    intent: "comment",
    kinds: ["change-request", "issue"],
    available: (item) => state(item) !== "closed",
    validate: (action) => validation(
      action,
      () => action.intent === "comment" && action.markdown.trim().length > 0
        ? []
        : ["comment markdown is required"],
    ),
    async execute(action, item, signal) {
      if (action.intent !== "comment") {
        return { status: "rejected", message: "Expected comment action" };
      }
      try {
        const ref = reference(item);
        return execute({
          http,
          path: `/repos/${ref.repository}/issues/${ref.number}/comments`,
          method: "POST",
          body: { body: action.markdown },
          signal,
        });
      } catch (error) {
        return {
          status: "rejected",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
    revalidate: selection,
  },
  {
    intent: "label",
    kinds: ["change-request", "issue"],
    available: () => true,
    validate: (action) => validation(
      action,
      () => action.intent === "label" && action.labels.length > 0
        && action.labels.every((label) => label.trim().length > 0)
        ? []
        : ["at least one label is required"],
    ),
    async execute(action, item, signal) {
      if (action.intent !== "label") {
        return { status: "rejected", message: "Expected label action" };
      }
      try {
        const ref = reference(item);
        return execute({
          http,
          path: `/repos/${ref.repository}/issues/${ref.number}/labels`,
          method: "POST",
          body: { labels: action.labels },
          signal,
        });
      } catch (error) {
        return {
          status: "rejected",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
    revalidate: selection,
  },
  {
    intent: "assign",
    kinds: ["issue"],
    available: (item) => state(item) !== "closed",
    validate: (action) => validation(
      action,
      () => action.intent === "assign" && action.assignees.length > 0
        && action.assignees.every((assignee) => assignee.trim().length > 0)
        ? []
        : ["at least one assignee is required"],
    ),
    async execute(action, item, signal) {
      if (action.intent !== "assign") {
        return { status: "rejected", message: "Expected assign action" };
      }
      try {
        const ref = reference(item);
        return execute({
          http,
          path: `/repos/${ref.repository}/issues/${ref.number}/assignees`,
          method: "POST",
          body: { assignees: action.assignees },
          signal,
        });
      } catch (error) {
        return {
          status: "rejected",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
    revalidate: selection,
  },
  {
    intent: "close",
    kinds: ["issue"],
    available: (item) => state(item) !== "closed",
    validate: (action) => validation(action),
    async execute(action, item, signal) {
      if (action.intent !== "close") {
        return { status: "rejected", message: "Expected close action" };
      }
      try {
        const ref = reference(item);
        return execute({
          http,
          path: `/repos/${ref.repository}/issues/${ref.number}`,
          method: "PATCH",
          body: { state: "closed" },
          signal,
          confirmedItem: withState(item, "closed"),
        });
      } catch (error) {
        return {
          status: "rejected",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
    revalidate: selection,
  },
];

export const githubActionCapabilities = (): Readonly<
  Partial<Record<Kind, readonly TriageAction["intent"][]>>
> => {
  const presentationOrder: readonly TriageAction["intent"][] = [
    "merge",
    "comment",
    "assign",
    "close",
    "label",
  ];
  const capabilities = new Map<Kind, TriageAction["intent"][]>();
  for (const definition of createGithubActionDefinitions()) {
    for (const kind of definition.kinds) {
      const intents = capabilities.get(kind) ?? [];
      intents.push(definition.intent);
      capabilities.set(kind, intents);
    }
  }
  return Object.freeze(Object.fromEntries(
    [...capabilities].map(([kind, intents]) => [
      kind,
      Object.freeze(intents.sort(
        (left, right) =>
          presentationOrder.indexOf(left) - presentationOrder.indexOf(right),
      )),
    ]),
  ));
};
