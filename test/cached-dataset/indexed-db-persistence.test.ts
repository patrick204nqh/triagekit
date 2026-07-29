import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { createIndexedDbDatasetPersistence } from "../../src/runtime/cached-dataset/indexed-db-persistence";
import type { PersistedSlice } from "../../src/runtime/cached-dataset/persistence";

let database = 0;

const createPersistence = () =>
  createIndexedDbDatasetPersistence(`triagekit-test-${database += 1}`);

const slice = (overrides: Partial<PersistedSlice> = {}): PersistedSlice => ({
  key: { connectionKey: "connection-a", target: "target", kind: "issue" },
  schema: 1,
  items: [],
  validatedAt: 900_000,
  lastAccessedAt: 900_000,
  bytes: 40,
  ...overrides,
});

const seedConnections = async (
  persistence: Awaited<ReturnType<typeof createIndexedDbDatasetPersistence>>,
  connectionKeys: readonly string[],
) => {
  for (const connectionKey of connectionKeys) {
    await persistence.activateGeneration(connectionKey, 1);
    await persistence.commit(slice({
      key: { connectionKey, target: "target", kind: "issue" },
    }), 1);
  }
};

describe("IndexedDB dataset persistence", () => {
  it("rejects a stale generation in the same transaction as the write", async () => {
    const persistence = await createPersistence();
    await persistence.activateGeneration("connection-a", 3);

    expect(await persistence.commit(slice(), 2)).toBe("superseded");
    expect(await persistence.hydrate("connection-a")).toEqual([]);
  });

  it("removes only one Provider Connection", async () => {
    const persistence = await createPersistence();
    await seedConnections(persistence, ["connection-a", "connection-b"]);

    await persistence.removeConnection("connection-a");

    expect(await persistence.hydrate("connection-a")).toEqual([]);
    expect(await persistence.hydrate("connection-b")).toHaveLength(1);
  });

  it("updates a stored slice's validation metadata", async () => {
    const persistence = await createPersistence();
    await persistence.activateGeneration("connection-a", 1);
    await persistence.commit(slice(), 1);

    await persistence.touch(slice().key, 1_000_000, "etag-2");

    expect(await persistence.hydrate("connection-a")).toMatchObject([{
      validatedAt: 1_000_000,
      lastAccessedAt: 1_000_000,
      validator: "etag-2",
    }]);
  });

  it("prunes expired slices before least-recent inactive slices", async () => {
    const persistence = await createPersistence();
    await persistence.activateGeneration("active", 1);
    await persistence.activateGeneration("inactive", 1);
    await persistence.commit(slice({
      key: { connectionKey: "inactive", target: "expired", kind: "issue" },
      validatedAt: 400_000,
      lastAccessedAt: 900_000,
      bytes: 40,
    }), 1);
    await persistence.commit(slice({
      key: { connectionKey: "inactive", target: "least-recent", kind: "issue" },
      lastAccessedAt: 600_000,
      bytes: 80,
    }), 1);
    await persistence.commit(slice({
      key: { connectionKey: "inactive", target: "recent", kind: "issue" },
      lastAccessedAt: 800_000,
      bytes: 60,
    }), 1);
    await persistence.commit(slice({
      key: { connectionKey: "active", target: "active", kind: "issue" },
      bytes: 20,
    }), 1);
    expect((await persistence.hydrate("inactive")).map((stored) => stored.bytes)).toEqual([40, 80, 60]);
    expect((await persistence.hydrate("active")).map((stored) => stored.bytes)).toEqual([20]);

    const report = await persistence.prune({
      now: 1_000_000,
      expiresBefore: 500_000,
      softBytes: 100,
      activeConnectionKeys: new Set(["active"]),
    });

    expect(report.evicted.map((key) => key.target)).toEqual(["expired", "least-recent"]);
  });
});
