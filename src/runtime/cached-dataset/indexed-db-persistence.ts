import type {
  DatasetPersistence,
  PersistedSlice,
  PrunePolicy,
  PruneReport,
} from "./persistence";
import type { SliceKey } from "./types";

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

const request = <T>(value: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  value.addEventListener("success", () => resolve(value.result), { once: true });
  value.addEventListener("error", () => reject(value.error ?? new Error("IndexedDB request failed")), { once: true });
});

const transactionCompleted = (transaction: IDBTransaction): Promise<void> => new Promise((resolve, reject) => {
  transaction.addEventListener("complete", () => resolve(), { once: true });
  transaction.addEventListener("abort", () => reject(transaction.error ?? new Error("IndexedDB transaction aborted")), { once: true });
  transaction.addEventListener("error", () => reject(transaction.error ?? new Error("IndexedDB transaction failed")), { once: true });
});

const openDatabase = (name: string): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  if (typeof indexedDB === "undefined") {
    reject(new Error("IndexedDB is not available"));
    return;
  }

  const opening = indexedDB.open(name, DATABASE_VERSION);
  opening.addEventListener("upgradeneeded", () => {
    const database = opening.result;
    if (!database.objectStoreNames.contains(SLICES_STORE)) {
      const slices = database.createObjectStore(SLICES_STORE, { keyPath: "id" });
      slices.createIndex("connectionKey", "connectionKey", { unique: false });
      slices.createIndex("validatedAt", "validatedAt", { unique: false });
      slices.createIndex("lastAccessedAt", "lastAccessedAt", { unique: false });
    }
    if (!database.objectStoreNames.contains(GENERATIONS_STORE)) {
      database.createObjectStore(GENERATIONS_STORE, { keyPath: "connectionKey" });
    }
  }, { once: true });
  opening.addEventListener("success", () => resolve(opening.result), { once: true });
  opening.addEventListener("error", () => reject(opening.error ?? new Error("IndexedDB could not open")), { once: true });
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
      transaction.objectStore(GENERATIONS_STORE).put({ connectionKey, generation } satisfies StoredGeneration);
      await transactionCompleted(transaction);
    },

    async hydrate(connectionKey): Promise<readonly PersistedSlice[]> {
      const transaction = database.transaction(SLICES_STORE, "readonly");
      const index = transaction.objectStore(SLICES_STORE).index("connectionKey");
      const stored = await request(index.getAll(IDBKeyRange.only(connectionKey)) as IDBRequest<StoredSlice[]>);
      await transactionCompleted(transaction);
      return Object.freeze(stored.map(toPersistedSlice));
    },

    async commit(slice, generation): Promise<"committed" | "superseded"> {
      const transaction = database.transaction([SLICES_STORE, GENERATIONS_STORE], "readwrite");
      const generations = transaction.objectStore(GENERATIONS_STORE);
      const active = await request(generations.get(slice.key.connectionKey) as IDBRequest<StoredGeneration | undefined>);
      if (active?.generation !== generation) {
        await transactionCompleted(transaction);
        return "superseded";
      }
      transaction.objectStore(SLICES_STORE).put(toStoredSlice(slice));
      await transactionCompleted(transaction);
      return "committed";
    },

    async touch(key, validatedAt, validator): Promise<void> {
      const transaction = database.transaction(SLICES_STORE, "readwrite");
      const slices = transaction.objectStore(SLICES_STORE);
      const stored = await request(slices.get(encoded(key)) as IDBRequest<StoredSlice | undefined>);
      if (stored) {
        slices.put({
          ...stored,
          validatedAt,
          lastAccessedAt: validatedAt,
          ...(validator === undefined ? {} : { validator }),
        });
      }
      await transactionCompleted(transaction);
    },

    async removeConnection(connectionKey): Promise<void> {
      const transaction = database.transaction([SLICES_STORE, GENERATIONS_STORE], "readwrite");
      const slices = transaction.objectStore(SLICES_STORE);
      const keys = await request(slices.index("connectionKey").getAllKeys(IDBKeyRange.only(connectionKey)));
      for (const key of keys) slices.delete(key);
      transaction.objectStore(GENERATIONS_STORE).delete(connectionKey);
      await transactionCompleted(transaction);
    },

    async prune(policy: PrunePolicy): Promise<PruneReport> {
      const transaction = database.transaction(SLICES_STORE, "readwrite");
      const slices = transaction.objectStore(SLICES_STORE);
      const stored = await request(slices.getAll() as IDBRequest<StoredSlice[]>);
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

      await transactionCompleted(transaction);
      return Object.freeze({ evicted: Object.freeze(evicted) });
    },
  };
};
