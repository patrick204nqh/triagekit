import { z } from "zod";
import type {
  FocusPolicySnapshot,
  FocusPolicyStorage,
  FocusPolicyStore,
} from "./types";
import { normalizeLabelRules, reconcileRepositoryOrder } from "./policy";

const storedPolicySchema = z.strictObject({
  repositoryOrder: z.array(z.string()),
  labels: z.strictObject({
    include: z.array(z.string()),
    exclude: z.array(z.string()),
    enabled: z.boolean(),
  }),
});

function emptyPolicy(provider: string): FocusPolicySnapshot {
  return {
    provider,
    repositoryOrder: [],
    labels: { include: [], exclude: [], enabled: true },
  };
}

function parsePolicy(
  provider: string,
  stored: string | null,
): FocusPolicySnapshot {
  if (stored === null) return emptyPolicy(provider);
  try {
    const parsed = storedPolicySchema.safeParse(JSON.parse(stored));
    if (!parsed.success) return emptyPolicy(provider);
    const { repositoryOrder, labels } = parsed.data;
    return {
      provider,
      repositoryOrder: reconcileRepositoryOrder(repositoryOrder, []).saved,
      labels: normalizeLabelRules(labels),
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
        JSON.stringify({
          repositoryOrder: normalized.repositoryOrder,
          labels: normalized.labels,
        }),
      );
    },
  };
}
