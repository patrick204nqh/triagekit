// src/runtime/core/orchestrator.ts
import type { Scope, TriageError } from "../ingest/source";
import type {
  ProviderDeclaration,
  TriageFailure,
} from "../catalog/types";
import type { Kind } from "../dataset/item";
import type { ProviderPort } from "./ports";
import type { DatasetStore } from "./store";

export interface ProviderJob {
  provider: string;   // providerOf(source)
  scopeKey: string;   // scopeKey(scope)
  scope: Scope;
  token: string;
  port: ProviderPort;
}
export interface RefreshResult { errors: TriageError[]; }

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

// Parallel fetch, partial-failure tolerant. Fulfilled → replace that slice;
// rejected → keep the prior slice and record the error. Mirrors the per-source
// resilience of app-shell.ts:205-210, but now merging into the store.
export async function refresh(
  jobs: ProviderJob[], store: DatasetStore, now: () => number = Date.now,
): Promise<RefreshResult> {
  const settled = await Promise.allSettled(jobs.map(j => j.port.fetch(j.scope, j.token)));
  const errors: TriageError[] = [];
  settled.forEach((res, i) => {
    const job = jobs[i];
    if (res.status === "fulfilled") {
      store.replaceScope(job.provider, job.scopeKey, res.value.items, now());
      errors.push(...res.value.errors);
    } else {
      const reason = res.reason as { message?: string };
      errors.push({ target: job.provider, message: reason?.message ?? String(res.reason) });
    }
  });
  return { errors };
}
