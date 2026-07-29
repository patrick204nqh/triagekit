import { describe, expect, it, vi } from "vitest";
import {
  createMemoryConnectionState,
} from "../../src/runtime/cached-dataset/browser-connection-state";
import {
  createCachedDatasets,
} from "../../src/runtime/cached-dataset/cached-datasets";
import {
  createConnectionKey,
} from "../../src/runtime/cached-dataset/identity";
import {
  createMemoryDatasetPersistence,
} from "../../src/runtime/cached-dataset/memory-persistence";
import type {
  BoundProvider,
  ProviderDefinition,
} from "../../src/runtime/cached-dataset/provider";
import type {
  PersistedSlice,
} from "../../src/runtime/cached-dataset/persistence";
import type {
  DatasetSnapshot,
} from "../../src/runtime/cached-dataset/types";
import type { TriageItem } from "../../src/runtime/dataset/item";

const item = (id = "cached"): TriageItem => ({
  id,
  provider: "github",
  providerRef: { repository: "acme-corp/web", number: 1 },
  kind: "issue",
  title: "Issue",
  location: "acme-corp/web",
  signal: 10,
  createdAt: "2026-01-01T00:00:00Z",
  url: "https://example.invalid/1",
  details: {},
});

const flush = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
};

const pendingProvider = () => {
  const requests: unknown[] = [];
  const definition: ProviderDefinition = {
    id: "github",
    kinds: ["issue"],
    async bind(): Promise<BoundProvider> {
      return {
        discoverScope: async () => [],
        canonicalizeScope: (scope) => scope,
        targets: (scope) => scope.repos as readonly string[],
        async *fetchSlices(request) {
          requests.push(request);
          await new Promise<void>(() => {});
        },
        close() {},
      };
    },
  };
  return { definition, requests };
};

const persistedSlice = (
  connectionKey: string,
  validatedAt: number,
): PersistedSlice => ({
  key: {
    connectionKey,
    target: "acme-corp/web",
    kind: "issue",
  },
  schema: 1,
  items: [item()],
  validatedAt,
  lastAccessedAt: validatedAt,
  bytes: 100,
});

describe("Cached Datasets", () => {
  it("publishes cached items before background refresh", async () => {
    const persistence = createMemoryDatasetPersistence();
    const key = await createConnectionKey(
      "github",
      "token",
      { repos: ["acme-corp/web"] },
    );
    await persistence.activateGeneration(key, 0);
    await persistence.commit(persistedSlice(key, 1), 0);
    const provider = pendingProvider();
    const datasets = createCachedDatasets({
      providers: [provider.definition],
      persistence,
      connectionState: createMemoryConnectionState(),
      now: () => 600_001,
    });

    const connected = await datasets.connect("github", "token");
    const session = connected.open({
      scope: { repos: ["acme-corp/web"] },
      kinds: ["issue"],
      cadence: 300,
    });
    const states: DatasetSnapshot[] = [];
    session.subscribe((state) => states.push(state));
    await vi.waitFor(() =>
      expect(states.some((state) => state.items.length === 1)).toBe(true));

    expect(states[0].phase).toBe("hydrating");
    expect(provider.requests).toHaveLength(1);
  });

  it("never exposes another credential identity's slices", async () => {
    const persistence = createMemoryDatasetPersistence();
    const tokenAKey = await createConnectionKey(
      "github",
      "token-a",
      { repos: ["acme-corp/web"] },
    );
    await persistence.activateGeneration(tokenAKey, 0);
    await persistence.commit(persistedSlice(tokenAKey, 1), 0);
    const provider = pendingProvider();
    const datasets = createCachedDatasets({
      providers: [provider.definition],
      persistence,
      connectionState: createMemoryConnectionState(),
      now: () => 600_001,
    });

    const connected = await datasets.connect("github", "token-b");
    const session = connected.open({
      scope: { repos: ["acme-corp/web"] },
      kinds: ["issue"],
      cadence: 300,
    });
    await flush();

    expect(session.snapshot().items).toEqual([]);
  });

  it("disconnect retain-cache removes only the session credential", async () => {
    const state = createMemoryConnectionState();
    const provider = pendingProvider();
    const datasets = createCachedDatasets({
      providers: [provider.definition],
      persistence: createMemoryDatasetPersistence(),
      connectionState: state,
    });
    const connected = await datasets.connect("github", "token");
    const session = connected.open({
      scope: { repos: ["acme-corp/web"] },
      kinds: ["issue"],
      cadence: "off",
    });
    await flush();

    await session.disconnect("retain-cache");

    expect(state.credential("github")).toBeNull();
    expect(state.scope("github")).toEqual({ repos: ["acme-corp/web"] });
    expect(session.snapshot().phase).toBe("closed");
  });
});
