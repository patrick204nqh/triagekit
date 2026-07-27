import type {
  ProviderDeclaration,
  Scope,
  TriageFailure,
} from "../catalog/types";
import type { Kind } from "../dataset/item";
import type { DatasetStore } from "./store";

export interface ProviderRefreshJob {
  provider: ProviderDeclaration;
  scopeKey: string;
  scope: Scope;
  credential: string;
  kinds: readonly Kind[];
}

export interface ProviderRefreshResult {
  failures: TriageFailure[];
}

export async function refreshProviders(
  jobs: readonly ProviderRefreshJob[],
  store: DatasetStore,
  now: () => number = Date.now,
): Promise<ProviderRefreshResult> {
  const failures: TriageFailure[] = [];

  await Promise.all(jobs.map(async (job) => {
    const adapter = job.provider.adapter;
    if (!adapter) {
      failures.push({
        provider: job.provider.id,
        category: "provider",
        message: `provider "${job.provider.id}" has no adapter`,
      });
      return;
    }

    try {
      const outcomes = await adapter.refresh({
        credential: job.credential,
        scope: job.scope,
        kinds: job.kinds,
      });

      for (const outcome of outcomes) {
        failures.push(...outcome.failures);
        if (outcome.status === "success" || outcome.status === "partial") {
          store.replaceKind(
            job.provider.id,
            job.scopeKey,
            outcome.kind,
            outcome.items,
            now(),
          );
        }
      }
    } catch (error) {
      failures.push({
        provider: job.provider.id,
        category: "provider",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }));

  return { failures };
}
