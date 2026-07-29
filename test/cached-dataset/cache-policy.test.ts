import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyFreshness,
} from "../../src/runtime/cached-dataset/cached-datasets";
import {
  DATASET_RETENTION_MS,
  DATASET_SOFT_BYTES,
  expiresAt,
} from "../../src/runtime/cached-dataset/clock";
import {
  createFallbackDatasetPersistence,
} from "../../src/runtime/cached-dataset/fallback-persistence";
import {
  createMemoryDatasetPersistence,
} from "../../src/runtime/cached-dataset/memory-persistence";
import type {
  PersistedSlice,
} from "../../src/runtime/cached-dataset/persistence";

const slice = (
  connectionKey: string,
  target: string,
  validatedAt: number,
  lastAccessedAt: number,
  bytes: number,
): PersistedSlice => ({
  key: { connectionKey, target, kind: "issue" },
  schema: 1,
  items: [],
  validatedAt,
  lastAccessedAt,
  bytes,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Cached Dataset cache policy", () => {
  it("uses cadence freshness and an exact seven-day expiry", () => {
    const now = 1_000_000;
    expect(classifyFreshness({
      validatedAt: now - 300_001,
      now,
      cadence: 300,
    })).toBe("stale");
    expect(classifyFreshness({
      validatedAt: now - 300_000,
      now,
      cadence: "off",
    })).toBe("fresh");
    expect(expiresAt(now)).toBe(now + 7 * 24 * 60 * 60 * 1_000);
    expect(DATASET_RETENTION_MS).toBe(604_800_000);
  });

  it("evicts expired first, then inactive LRU, while protecting active data", async () => {
    const persistence = createMemoryDatasetPersistence();
    const now = 1_000_000_000;
    for (const connectionKey of ["inactive", "active"]) {
      await persistence.activateGeneration(connectionKey, 1);
    }
    await persistence.commit(slice(
      "inactive",
      "expired",
      now - DATASET_RETENTION_MS - 1,
      now - 1,
      1,
    ), 1);
    await persistence.commit(slice(
      "inactive",
      "least-recent",
      now,
      now - 2,
      DATASET_SOFT_BYTES,
    ), 1);
    await persistence.commit(slice(
      "inactive",
      "recent",
      now,
      now - 1,
      10,
    ), 1);
    await persistence.commit(slice(
      "active",
      "active",
      now,
      now - 3,
      DATASET_SOFT_BYTES,
    ), 1);

    const report = await persistence.prune({
      now,
      expiresBefore: now - DATASET_RETENTION_MS,
      softBytes: DATASET_SOFT_BYTES,
      activeConnectionKeys: new Set(["active"]),
    });

    expect(report.evicted.map((key) => key.target))
      .toEqual(["expired", "least-recent", "recent"]);
    expect(await persistence.hydrate("active")).toHaveLength(1);
  });

  it("surfaces a memory-degradation warning", async () => {
    vi.stubGlobal("indexedDB", undefined);

    const persistence = await createFallbackDatasetPersistence();

    expect(persistence.mode()).toBe("memory");
    expect(persistence.warning())
      .toMatch(/^Browser cache unavailable; using memory only:/);
  });
});
