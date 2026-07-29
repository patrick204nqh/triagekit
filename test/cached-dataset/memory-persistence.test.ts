import { describe, expect, it } from "vitest";
import { createMemoryDatasetPersistence } from "../../src/runtime/cached-dataset/memory-persistence";
import type { PersistedSlice } from "../../src/runtime/cached-dataset/persistence";

const slice = (overrides: Partial<PersistedSlice> = {}): PersistedSlice => ({
  key: { connectionKey: "connection-a", target: "target", kind: "issue" },
  schema: 1,
  items: [],
  validatedAt: 900_000,
  lastAccessedAt: 900_000,
  bytes: 40,
  ...overrides,
});

const seedForPrune = async (
  persistence: ReturnType<typeof createMemoryDatasetPersistence>,
) => {
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
};

describe("memory dataset persistence", () => {
  it("commits only the active generation", async () => {
    const persistence = createMemoryDatasetPersistence();
    await persistence.activateGeneration("connection-a", 2);
    expect(await persistence.commit(slice({ schema: 1 }), 1)).toBe("superseded");
    expect(await persistence.commit(slice({ schema: 2 }), 2)).toBe("committed");
    expect(await persistence.hydrate("connection-a")).toHaveLength(1);
  });

  it("prunes expired before least-recently-used inactive slices", async () => {
    const persistence = createMemoryDatasetPersistence();
    await seedForPrune(persistence);
    const report = await persistence.prune({
      now: 1_000_000,
      expiresBefore: 500_000,
      softBytes: 100,
      activeConnectionKeys: new Set(["active"]),
    });
    expect(report.evicted.map((key) => key.target)).toEqual(["expired", "least-recent"]);
  });

  it("returns frozen copies that cannot change persisted slices", async () => {
    const persistence = createMemoryDatasetPersistence();
    await persistence.activateGeneration("connection-a", 1);
    await persistence.commit(slice({ items: [{
      id: "github:1",
      provider: "github",
      providerRef: { number: 1 },
      kind: "issue",
      title: "Original",
      location: "acme-corp/web",
      signal: 50,
      createdAt: "2026-01-01T00:00:00.000Z",
      url: "https://example.test/1",
      details: { labels: ["bug"] },
    }] }), 1);

    const [hydrated] = await persistence.hydrate("connection-a");
    expect(Object.isFrozen(hydrated)).toBe(true);
    expect(Object.isFrozen(hydrated.items)).toBe(true);
    expect(Object.isFrozen(hydrated.items[0])).toBe(true);
    expect(Object.isFrozen(hydrated.items[0].details)).toBe(true);
    expect(() => { (hydrated.items[0] as { title: string }).title = "Changed"; }).toThrow();
    expect((await persistence.hydrate("connection-a"))[0].items[0].title).toBe("Original");
  });
});
