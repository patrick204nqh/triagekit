import type {
  DatasetPersistence,
  PersistedSlice,
  PrunePolicy,
  PruneReport,
} from "./persistence";
import type { SliceKey } from "./types";

const encoded = (key: SliceKey) =>
  JSON.stringify([key.connectionKey, key.target, key.kind]);

const frozenCopy = <T>(value: T): T => {
  const copy = structuredClone(value);
  const seen = new WeakSet<object>();
  const freeze = (candidate: unknown): void => {
    if (candidate === null || typeof candidate !== "object" || seen.has(candidate)) return;
    seen.add(candidate);
    for (const nested of Object.values(candidate)) freeze(nested);
    Object.freeze(candidate);
  };
  freeze(copy);
  return copy;
};

const compareLeastRecent = ([aKey, a]: readonly [string, PersistedSlice], [bKey, b]: readonly [string, PersistedSlice]) =>
  a.lastAccessedAt - b.lastAccessedAt || aKey.localeCompare(bKey);

export const createMemoryDatasetPersistence = (): DatasetPersistence => {
  const slices = new Map<string, PersistedSlice>();
  const generations = new Map<string, number>();

  const evict = (key: string, report: SliceKey[]): void => {
    const slice = slices.get(key);
    if (!slice) return;
    slices.delete(key);
    report.push(frozenCopy(slice.key));
  };

  const storedBytes = (): number =>
    [...slices.values()].reduce((total, slice) => total + slice.bytes, 0);

  return {
    async activateGeneration(connectionKey, generation): Promise<void> {
      generations.set(connectionKey, generation);
    },

    async hydrate(connectionKey): Promise<readonly PersistedSlice[]> {
      return Object.freeze(
        [...slices.values()]
          .filter((slice) => slice.key.connectionKey === connectionKey)
          .map(frozenCopy),
      );
    },

    async commit(slice, generation): Promise<"committed" | "superseded"> {
      if (generations.get(slice.key.connectionKey) !== generation) return "superseded";
      slices.set(encoded(slice.key), frozenCopy(slice));
      return "committed";
    },

    async touch(key, validatedAt, validator): Promise<void> {
      const stored = slices.get(encoded(key));
      if (!stored) return;
      slices.set(encoded(key), frozenCopy({
        ...stored,
        validatedAt,
        lastAccessedAt: validatedAt,
        ...(validator === undefined ? {} : { validator }),
      }));
    },

    async removeConnection(connectionKey): Promise<void> {
      generations.delete(connectionKey);
      for (const [key, slice] of slices) {
        if (slice.key.connectionKey === connectionKey) slices.delete(key);
      }
    },

    async prune(policy: PrunePolicy): Promise<PruneReport> {
      const evicted: SliceKey[] = [];
      for (const [key, slice] of slices) {
        if (slice.validatedAt < policy.expiresBefore) evict(key, evicted);
      }

      const inactive = () => [...slices.entries()]
        .filter(([, slice]) => !policy.activeConnectionKeys.has(slice.key.connectionKey))
        .sort(compareLeastRecent);
      for (const [key] of inactive()) {
        if (storedBytes() <= policy.softBytes) break;
        evict(key, evicted);
      }

      return Object.freeze({ evicted: Object.freeze(evicted) });
    },
  };
};
