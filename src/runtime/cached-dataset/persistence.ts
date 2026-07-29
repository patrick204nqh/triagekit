import type { TriageItem } from "../dataset/item";
import type { SliceKey } from "./types";

export interface PersistedSlice {
  readonly key: SliceKey;
  readonly schema: number;
  readonly items: readonly TriageItem[];
  readonly validatedAt: number;
  readonly lastAccessedAt: number;
  readonly validator?: string;
  readonly bytes: number;
}

export interface PrunePolicy {
  readonly now: number;
  readonly expiresBefore: number;
  readonly softBytes: number;
  readonly activeConnectionKeys: ReadonlySet<string>;
}

export interface PruneReport {
  readonly evicted: readonly SliceKey[];
}

export interface DatasetPersistence {
  activateGeneration(connectionKey: string, generation: number): Promise<void>;
  hydrate(connectionKey: string): Promise<readonly PersistedSlice[]>;
  commit(
    slice: PersistedSlice,
    generation: number,
  ): Promise<"committed" | "superseded">;
  touch(key: SliceKey, validatedAt: number, validator?: string): Promise<void>;
  removeConnection(connectionKey: string): Promise<void>;
  prune(policy: PrunePolicy): Promise<PruneReport>;
}
