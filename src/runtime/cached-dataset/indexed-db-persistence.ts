import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  DatasetPersistence,
  PersistedSlice,
  PrunePolicy,
  PruneReport,
} from "./persistence";
import type { SliceKey } from "./types";
import { frozenCopy } from "./persistence-utils";

const DATABASE_VERSION = 1;
const SLICES_STORE = "slices";
const GENERATIONS_STORE = "generations";

interface StoredSlice extends PersistedSlice {
  readonly id: string;
  readonly connectionKey: string;
}

interface StoredGeneration {
  readonly connectionKey: string;
  readonly generation: number;
}

interface TriageDatabase extends DBSchema {
  slices: {
    key: string;
    value: StoredSlice;
    indexes: {
      connectionKey: string;
      validatedAt: number;
      lastAccessedAt: number;
    };
  };
  generations: {
    key: string;
    value: StoredGeneration;
  };
}

const encoded = (key: SliceKey) =>
  JSON.stringify([key.connectionKey, key.target, key.kind]);



const openDatabase = (name: string): Promise<IDBPDatabase<TriageDatabase>> =>
  openDB<TriageDatabase>(name, DATABASE_VERSION, {
    upgrade(database) {
      const slices = database.createObjectStore(SLICES_STORE, { keyPath: "id" });
      slices.createIndex("connectionKey", "connectionKey");
      slices.createIndex("validatedAt", "validatedAt");
      slices.createIndex("lastAccessedAt", "lastAccessedAt");
      database.createObjectStore(GENERATIONS_STORE, {
        keyPath: "connectionKey",
      });
    },
  });

const toStoredSlice = (slice: PersistedSlice): StoredSlice => ({
  ...structuredClone(slice),
  id: encoded(slice.key),
  connectionKey: slice.key.connectionKey,
});

const toPersistedSlice = (slice: StoredSlice): PersistedSlice => frozenCopy({
  key: slice.key,
  schema: slice.schema,
  items: slice.items,
  validatedAt: slice.validatedAt,
  lastAccessedAt: slice.lastAccessedAt,
  ...(slice.validator === undefined ? {} : { validator: slice.validator }),
  bytes: slice.bytes,
});

const compareLeastRecent = (a: StoredSlice, b: StoredSlice) =>
  a.lastAccessedAt - b.lastAccessedAt || a.id.localeCompare(b.id);

export const createIndexedDbDatasetPersistence = async (
  name = "triagekit",
): Promise<DatasetPersistence> => {
  const database = await openDatabase(name);

  return {
    async activateGeneration(connectionKey, generation): Promise<void> {
      const transaction = database.transaction(GENERATIONS_STORE, "readwrite");
      await transaction.store.put({ connectionKey, generation });
      await transaction.done;
    },

    async hydrate(connectionKey): Promise<readonly PersistedSlice[]> {
      const stored = await database.getAllFromIndex(
        SLICES_STORE,
        "connectionKey",
        connectionKey,
      );
      return Object.freeze(stored.map(toPersistedSlice));
    },

    async commit(slice, generation): Promise<"committed" | "superseded"> {
      const transaction = database.transaction([SLICES_STORE, GENERATIONS_STORE], "readwrite");
      const generations = transaction.objectStore(GENERATIONS_STORE);
      const active = await generations.get(slice.key.connectionKey);
      if (active?.generation !== generation) {
        await transaction.done;
        return "superseded";
      }
      await transaction.objectStore(SLICES_STORE).put(toStoredSlice(slice));
      await transaction.done;
      return "committed";
    },

    async touch(key, validatedAt, validator): Promise<void> {
      const transaction = database.transaction(SLICES_STORE, "readwrite");
      const slices = transaction.store;
      const stored = await slices.get(encoded(key));
      if (stored) {
        await slices.put({
          ...stored,
          validatedAt,
          lastAccessedAt: validatedAt,
          ...(validator === undefined ? {} : { validator }),
        });
      }
      await transaction.done;
    },

    async removeConnection(connectionKey): Promise<void> {
      const transaction = database.transaction([SLICES_STORE, GENERATIONS_STORE], "readwrite");
      const slices = transaction.objectStore(SLICES_STORE);
      const keys = await slices.index("connectionKey").getAllKeys(connectionKey);
      for (const key of keys) await slices.delete(key);
      await transaction.objectStore(GENERATIONS_STORE).delete(connectionKey);
      await transaction.done;
    },

    async prune(policy: PrunePolicy): Promise<PruneReport> {
      const transaction = database.transaction(SLICES_STORE, "readwrite");
      const slices = transaction.store;
      const stored = await slices.getAll();
      const evicted: SliceKey[] = [];
      const retained = new Map(stored.map((slice) => [slice.id, slice]));
      const evict = (slice: StoredSlice): void => {
        if (!retained.delete(slice.id)) return;
        slices.delete(slice.id);
        evicted.push(frozenCopy(slice.key));
      };

      for (const slice of stored) {
        if (slice.validatedAt < policy.expiresBefore) evict(slice);
      }

      const storedBytes = () =>
        [...retained.values()].reduce((total, slice) => total + slice.bytes, 0);
      const inactive = [...retained.values()]
        .filter((slice) => !policy.activeConnectionKeys.has(slice.key.connectionKey))
        .sort(compareLeastRecent);
      for (const slice of inactive) {
        if (storedBytes() <= policy.softBytes) break;
        evict(slice);
      }

      await transaction.done;
      return Object.freeze({ evicted: Object.freeze(evicted) });
    },
  };
};
