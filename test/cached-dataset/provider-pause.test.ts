import { describe, expect, it } from "vitest";
import {
  createMemoryConnectionState,
} from "../../src/runtime/cached-dataset/browser-connection-state";
import {
  createCachedDatasets,
} from "../../src/runtime/cached-dataset/cached-datasets";
import {
  createMemoryDatasetPersistence,
} from "../../src/runtime/cached-dataset/memory-persistence";
import type {
  BoundProvider,
  ProviderConnectionStatus,
  ProviderDefinition,
} from "../../src/runtime/cached-dataset/provider";

describe("provider-directed Dataset pauses", () => {
  it("publishes the exact retry time and blocks refresh until resumed", async () => {
    let status: ProviderConnectionStatus = {
      paused: true,
      retryAt: 5_000,
      reason: "GitHub rate limit",
    };
    let notify = (_next: ProviderConnectionStatus): void => undefined;
    let fetches = 0;
    const provider: ProviderDefinition = {
      id: "github",
      kinds: ["issue"],
      async bind(): Promise<BoundProvider> {
        return {
          discoverScope: async () => [],
          canonicalizeScope: (scope) => scope,
          targets: () => ["acme-corp/web"],
          status: () => status,
          subscribeStatus(observer) {
            notify = observer;
            observer(status);
            return () => undefined;
          },
          async *fetchSlices() {
            fetches += 1;
          },
          close() {},
        };
      },
    };
    const datasets = createCachedDatasets({
      providers: [provider],
      persistence: createMemoryDatasetPersistence(),
      connectionState: createMemoryConnectionState(),
      now: () => 1_000,
    });
    const connected = await datasets.connect("github", "token");
    const session = connected.open({
      scope: { repos: ["acme-corp/web"] },
      kinds: ["issue"],
      cadence: "off",
    });
    await new Promise((resolve) => globalThis.setTimeout(resolve, 0));

    expect(session.snapshot()).toMatchObject({
      phase: "paused",
      retryAt: 5_000,
    });
    await expect(session.refresh()).resolves.toMatchObject({
      status: "paused",
      retryAt: 5_000,
    });
    expect(fetches).toBe(0);

    status = { paused: false };
    notify(status);
    expect(session.snapshot().phase).toBe("ready");
  });
});
