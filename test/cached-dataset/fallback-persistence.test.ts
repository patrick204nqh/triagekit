import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFallbackDatasetPersistence } from "../../src/runtime/cached-dataset/fallback-persistence";
import { createIndexedDbDatasetPersistence } from "../../src/runtime/cached-dataset/indexed-db-persistence";
import type { PersistedSlice } from "../../src/runtime/cached-dataset/persistence";

const slice = (target = "target"): PersistedSlice => ({
  key: { connectionKey: "connection-a", target, kind: "issue" },
  schema: 1,
  items: [],
  validatedAt: 900_000,
  lastAccessedAt: 900_000,
  bytes: 40,
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("fallback dataset persistence", () => {
  it("uses memory when IndexedDB cannot open", async () => {
    vi.stubGlobal("indexedDB", undefined);

    const persistence = await createFallbackDatasetPersistence();
    await persistence.activateGeneration("connection-a", 1);

    expect(persistence.mode()).toBe("memory");
    expect(persistence.warning()).toMatch(/^Browser cache unavailable; using memory only:/);
    expect(await persistence.commit(slice(), 1)).toBe("committed");
  });

  it("keeps the hot projection after an IndexedDB write, prune, and retry fail", async () => {
    const seeded = await createIndexedDbDatasetPersistence();
    await seeded.activateGeneration("connection-a", 1);
    await seeded.commit(slice("existing"), 1);
    const persistence = await createFallbackDatasetPersistence();
    await persistence.activateGeneration("connection-a", 1);
    expect(await persistence.hydrate("connection-a")).toHaveLength(1);
    const transaction = IDBDatabase.prototype.transaction;
    let calls = 0;
    vi.spyOn(IDBDatabase.prototype, "transaction").mockImplementation(function (...args) {
      calls += 1;
      if (calls === 1 || calls === 3) {
        throw new DOMException("Quota exhausted", "QuotaExceededError");
      }
      return transaction.apply(this, args);
    });

    expect(await persistence.commit(slice("new"), 1)).toBe("committed");
    expect(calls).toBe(3);
    expect(persistence.mode()).toBe("memory");
    expect(persistence.warning()).toContain("Quota exhausted");
    expect(await persistence.hydrate("connection-a")).toHaveLength(2);
  });
});
