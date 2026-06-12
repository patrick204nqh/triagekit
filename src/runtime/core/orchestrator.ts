// src/runtime/core/orchestrator.ts
import type { Scope, TriageError } from "../ingest/source";
import type { ProviderPort } from "./ports";
import type { DatasetStore } from "./store";
import { runEnrichers } from "./enrichment";

export interface ProviderJob {
  provider: string;   // providerOf(source)
  scopeKey: string;   // scopeKey(scope)
  scope: Scope;
  token: string;
  port: ProviderPort;
}
export interface RefreshResult { errors: TriageError[]; }

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
  errors.push(...await runEnrichers(store, { jobs }));
  return { errors };
}
