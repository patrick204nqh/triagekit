import type {
  RuntimeCatalog,
  Scope,
} from "../catalog/types";
import type { ProviderRefreshJob } from "../core/orchestrator";

export interface InsightRefreshInput {
  catalog: RuntimeCatalog;
  credentialFor(providerId: string): string | undefined;
  scopeFor(providerId: string): Scope;
  scopeKeyFor(providerId: string, scope: Scope): string;
}

export function buildInsightRefreshJobs(
  input: InsightRefreshInput,
): readonly ProviderRefreshJob[] {
  const jobs: ProviderRefreshJob[] = [];

  for (const provider of input.catalog.providers()) {
    if (provider.status !== "ready" || !provider.adapter) continue;
    const credential = input.credentialFor(provider.id);
    const scope = input.scopeFor(provider.id);
    if (!credential || Object.keys(scope).length === 0) continue;

    const kinds = provider.kinds
      .filter((kind) => Boolean(input.catalog.readyKind(kind)))
      .sort();
    if (kinds.length === 0) continue;

    jobs.push(Object.freeze({
      provider,
      scopeKey: input.scopeKeyFor(provider.id, scope),
      scope: Object.freeze({ ...scope }),
      credential,
      kinds: Object.freeze(kinds),
    }));
  }

  return Object.freeze(jobs);
}
