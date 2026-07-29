import { createIndexedDbDatasetPersistence } from "./indexed-db-persistence";
import { createMemoryDatasetPersistence } from "./memory-persistence";
import type {
  DatasetPersistence,
  PersistedSlice,
  PrunePolicy,
  PruneReport,
} from "./persistence";
import type { SliceKey } from "./types";
import {
  DATASET_RETENTION_MS,
  DATASET_SOFT_BYTES,
} from "./clock";

export interface FallbackDatasetPersistence extends DatasetPersistence {
  mode(): "indexeddb" | "memory";
  warning(): string | undefined;
}

const safeMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const recoveryPolicy = (activeConnectionKeys: ReadonlySet<string>): PrunePolicy => {
  const now = Date.now();
  return {
    now,
    expiresBefore: now - DATASET_RETENTION_MS,
    softBytes: DATASET_SOFT_BYTES,
    activeConnectionKeys,
  };
};

const wrapPersistent = (persistent: DatasetPersistence): FallbackDatasetPersistence => {
  const memory = createMemoryDatasetPersistence();
  const activeConnectionKeys = new Set<string>();
  const generations = new Map<string, number>();
  let mode: "indexeddb" | "memory" = "indexeddb";
  let warning: string | undefined;

  const degrade = (error: unknown): void => {
    mode = "memory";
    warning = `Browser cache unavailable; using memory only: ${safeMessage(error)}`;
  };

  const write = async <T>(
    persistentWrite: () => Promise<T>,
    memoryWrite: () => Promise<T>,
  ): Promise<T> => {
    const memoryResult = await memoryWrite();
    if (mode === "memory") return memoryResult;
    try {
      return await persistentWrite();
    } catch {
      try {
        await persistent.prune(recoveryPolicy(activeConnectionKeys));
        return await persistentWrite();
      } catch (error) {
        degrade(error);
        return memoryResult;
      }
    }
  };

  return {
    async activateGeneration(connectionKey, generation): Promise<void> {
      activeConnectionKeys.add(connectionKey);
      generations.set(connectionKey, generation);
      await write(
        () => persistent.activateGeneration(connectionKey, generation),
        () => memory.activateGeneration(connectionKey, generation),
      );
    },

    async hydrate(connectionKey): Promise<readonly PersistedSlice[]> {
      if (mode === "memory") return memory.hydrate(connectionKey);
      try {
        const slices = await persistent.hydrate(connectionKey);
        const generation = generations.get(connectionKey) ?? Number.NaN;
        await memory.activateGeneration(connectionKey, generation);
        for (const slice of slices) await memory.commit(slice, generation);
        return slices;
      } catch (error) {
        degrade(error);
        return memory.hydrate(connectionKey);
      }
    },

    async commit(slice, generation): Promise<"committed" | "superseded"> {
      return write(
        () => persistent.commit(slice, generation),
        () => memory.commit(slice, generation),
      );
    },

    async touch(key, validatedAt, validator): Promise<void> {
      await write(
        () => persistent.touch(key, validatedAt, validator),
        () => memory.touch(key, validatedAt, validator),
      );
    },

    async removeConnection(connectionKey): Promise<void> {
      activeConnectionKeys.delete(connectionKey);
      generations.delete(connectionKey);
      await write(
        () => persistent.removeConnection(connectionKey),
        () => memory.removeConnection(connectionKey),
      );
    },

    async prune(policy): Promise<PruneReport> {
      return write(
        () => persistent.prune(policy),
        () => memory.prune(policy),
      );
    },

    mode: () => mode,
    warning: () => warning,
  };
};

const wrapMemory = (
  memory: DatasetPersistence,
  message: string,
): FallbackDatasetPersistence => ({
  ...memory,
  mode: () => "memory",
  warning: () => message,
});

export const createFallbackDatasetPersistence = async (): Promise<FallbackDatasetPersistence> => {
  try {
    return wrapPersistent(await createIndexedDbDatasetPersistence("triagekit"));
  } catch (error) {
    return wrapMemory(
      createMemoryDatasetPersistence(),
      `Browser cache unavailable; using memory only: ${safeMessage(error)}`,
    );
  }
};
