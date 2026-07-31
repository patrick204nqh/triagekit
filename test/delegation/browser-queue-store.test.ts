import { describe, expect, it } from "vitest";
import type { StoragePort } from "../../src/runtime/core/ports";
import {
  createBrowserQueueStore,
} from "../../src/runtime/delegation/browser-queue-store";
import {
  createDelegationQueue,
  queueKey,
} from "../../src/runtime/delegation/queue";
import type { QueueIdentity } from "../../src/runtime/delegation/types";

class MapStorage implements StoragePort {
  readonly values = new Map<string, string>();

  get(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  set(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const identity = (itemId: string): QueueIdentity => ({
  provider: "github",
  itemId,
  kind: "issue",
  repository: "acme-corp/core",
});

describe("browser delegation queue store", () => {
  it("round-trips mode, mission note, item note, and entries", () => {
    const storage = new MapStorage();
    const store = createBrowserQueueStore(storage);
    const queue = createDelegationQueue(store);
    const target = identity("github:42");
    queue.add(target, 1000);
    queue.setMode("implement");
    queue.setMissionNote("Keep the API compatible");
    queue.setItemNote(queueKey(target), "Do not update the lockfile");

    const raw = storage.values.get("triagekit.handoff.queue.v1")!;
    expect(raw).toContain("github:42");
    expect(raw).not.toContain("details");
    const restored = createDelegationQueue(store).snapshot();
    expect(restored.mode).toBe("implement");
    expect(restored.missionNote).toBe("Keep the API compatible");
    expect(restored.entries[0].note).toBe("Do not update the lockfile");
  });

  it("discards malformed entries individually", () => {
    const storage = new MapStorage();
    storage.set("triagekit.handoff.queue.v1", JSON.stringify({
      mode: "investigate",
      entries: [{
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
      ],
    }));

    expect(createBrowserQueueStore(storage).load()).toEqual({
      mode: "investigate",
      entries: [
        expect.objectContaining({
          identity: expect.objectContaining({ itemId: "safe" }),
        }),
      ],
    });
  });

  it("ignores the obsolete delegation storage key", () => {
    const storage = new MapStorage();
    storage.set(
      "triagekit.delegation.queue.v1",
      JSON.stringify([{ identity: identity("legacy"), selectedAt: 1 }]),
    );

    expect(createDelegationQueue(createBrowserQueueStore(storage)).snapshot())
      .toMatchObject({ mode: "investigate", entries: [] });
  });

  it("falls back safely when aggregate state is malformed", () => {
    const storage = new MapStorage();
    storage.set("triagekit.handoff.queue.v1", JSON.stringify({
      mode: "ship-it",
      missionNote: 42,
      entries: "not-an-array",
    }));

    expect(createDelegationQueue(createBrowserQueueStore(storage)).snapshot())
      .toMatchObject({ mode: "investigate", entries: [] });
  });

  it("recovers from corrupt session JSON", () => {
    const storage = new MapStorage();
    storage.set("triagekit.handoff.queue.v1", "{bad");
    expect(createBrowserQueueStore(storage).load()).toEqual({
      mode: "investigate",
      entries: [],
    });
  });
});
