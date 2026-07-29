import type {
  FocusPolicySnapshot,
  FocusPolicyStorage,
  FocusPolicyStore,
} from "./types";
import { normalizeLabelRules, reconcileRepositoryOrder } from "./policy";

function emptyPolicy(provider: string): FocusPolicySnapshot {
  return {
    provider,
    repositoryOrder: [],
    labels: { include: [], exclude: [], enabled: true },
  };
}

function stringArray(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
    ? value
    : null;
}

function parsePolicy(
  provider: string,
  stored: string | null,
): FocusPolicySnapshot {
  if (stored === null) return emptyPolicy(provider);
  try {
    const value = JSON.parse(stored) as Record<string, unknown>;
    const repositoryOrder = stringArray(value.repositoryOrder);
    const labels = value.labels as Record<string, unknown> | undefined;
    const include = stringArray(labels?.include);
    const exclude = stringArray(labels?.exclude);
    if (
      !repositoryOrder
      || !include
      || !exclude
      || typeof labels?.enabled !== "boolean"
    ) {
      return emptyPolicy(provider);
    }
    return {
      provider,
      repositoryOrder: reconcileRepositoryOrder(repositoryOrder, []).saved,
      labels: normalizeLabelRules({
        include,
        exclude,
        enabled: labels.enabled,
      }),
    };
  } catch {
    return emptyPolicy(provider);
  }
}

export function createFocusPolicyStore(
  storage: FocusPolicyStorage,
): FocusPolicyStore {
  return {
    get(provider) {
      return parsePolicy(provider, storage.get(`triagekit.focus.${provider}`));
    },
    set(policy) {
      const normalized: FocusPolicySnapshot = {
        provider: policy.provider,
        repositoryOrder: reconcileRepositoryOrder(
          policy.repositoryOrder,
          [],
        ).saved,
        labels: normalizeLabelRules(policy.labels),
      };
      storage.set(
        `triagekit.focus.${policy.provider}`,
        JSON.stringify(normalized),
      );
    },
  };
}
