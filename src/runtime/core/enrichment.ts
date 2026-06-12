import type { TriageError, Scope } from "../ingest/source";
import type { DatasetStore } from "./store";

export interface EnrichJob {
  provider: string;
  token: string;
  scope: Scope;
}

export interface EnrichCtx {
  jobs: EnrichJob[];
}

export interface PostFetchEnricher {
  id: string;
  enrich(store: DatasetStore, ctx: EnrichCtx): Promise<TriageError[]>;
}

const enrichers: PostFetchEnricher[] = [];

export function registerEnricher(enricher: PostFetchEnricher): void {
  enrichers.push(enricher);
}

export function listEnrichers(): PostFetchEnricher[] {
  return [...enrichers];
}

export async function runEnrichers(store: DatasetStore, ctx: EnrichCtx): Promise<TriageError[]> {
  const errors: TriageError[] = [];
  for (const enricher of listEnrichers()) errors.push(...await enricher.enrich(store, ctx));
  return errors;
}
