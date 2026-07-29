import { describe, expect, it } from "vitest";
import type { StoragePort } from "../../src/runtime/core/ports";
import {
  createBrowserQueueStore,
} from "../../src/runtime/delegation/browser-queue-store";
import {
  createDelegationQueue,
} from "../../src/runtime/delegation/queue";

class MapStorage implements StoragePort {
  readonly values = new Map<string, string>();

  get(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  set(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("browser delegation queue store", () => {
  it("restores session entries and persists identity-only state", () => {
    const storage = new MapStorage();
    const store = createBrowserQueueStore(storage);
    const queue = createDelegationQueue(store);
    queue.add({
      provider: "github",
      itemId: "github:42",
      kind: "issue",
      repository: "acme-corp/core",
    }, 1000);

    const raw = storage.values.get("triagekit.delegation.queue.v1")!;
    expect(raw).toContain("github:42");
    expect(raw).not.toContain("details");
    expect(createDelegationQueue(store).snapshot().entries).toHaveLength(1);
  });

  it("discards malformed entries individually", () => {
    const storage = new MapStorage();
    storage.set("triagekit.delegation.queue.v1", JSON.stringify([
      {
        identity: {
          provider: "github",
          itemId: "safe",
          kind: "issue",
          repository: "acme-corp/core",
        },
        selectedAt: 1000,
        selected: true,
        status: "queued",
      },
      {
        identity: {
          provider: "github",
          itemId: "unsafe",
          kind: "not-a-kind",
          repository: "acme-corp/core",
        },
        selectedAt: "yesterday",
        selected: true,
        status: "queued",
        details: { authToken: "forbidden" },
      },
    ]));

    expect(createBrowserQueueStore(storage).load()).toEqual([
      expect.objectContaining({
        identity: expect.objectContaining({ itemId: "safe" }),
      }),
    ]);
  });

  it("recovers from corrupt session JSON", () => {
    const storage = new MapStorage();
    storage.set("triagekit.delegation.queue.v1", "{bad");
    expect(createBrowserQueueStore(storage).load()).toEqual([]);
  });
});
