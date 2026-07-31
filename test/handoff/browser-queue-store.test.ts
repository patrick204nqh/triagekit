import { describe, expect, it } from "vitest";
import type { StoragePort } from "../../src/runtime/core/ports";
import {
  createBrowserHandoffQueueStore,
} from "../../src/runtime/handoff/browser-queue-store";
import {
  createHandoffQueue,
  queueKey,
} from "../../src/runtime/handoff/queue";
import type { HandoffIdentity } from "../../src/runtime/handoff/types";

class MapStorage implements StoragePort {
  readonly values = new Map<string, string>();

  get(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  set(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const identity = (itemId: string): HandoffIdentity => ({
  provider: "github",
  itemId,
  kind: "issue",
  repository: "acme-corp/core",
});

describe("browser handoff queue store", () => {
  it("round-trips mode, mission note, item note, and entries", () => {
    const storage = new MapStorage();
    const store = createBrowserHandoffQueueStore(storage);
    const queue = createHandoffQueue(store);
    const target = identity("github:42");
    queue.add(target, 1000);
    queue.setMode("implement");
    queue.setMissionNote("Keep the API compatible");
    queue.setItemNote(queueKey(target), "Do not update the lockfile");

    const raw = storage.values.get("triagekit.handoff.queue.v1")!;
    expect(raw).toContain("github:42");
    expect(raw).not.toContain("details");
    const restored = createHandoffQueue(store).snapshot();
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

    expect(createBrowserHandoffQueueStore(storage).load()).toEqual({
      mode: "investigate",
      entries: [
        expect.objectContaining({
          identity: expect.objectContaining({ itemId: "safe" }),
        }),
      ],
    });
  });

  it("ignores the obsolete handoff storage key", () => {
    const storage = new MapStorage();
    storage.set(
      "triagekit.handoff.queue.v1",
      JSON.stringify([{ identity: identity("legacy"), selectedAt: 1 }]),
    );

    expect(createHandoffQueue(createBrowserHandoffQueueStore(storage)).snapshot())
      .toMatchObject({ mode: "investigate", entries: [] });
  });

  it("falls back safely when aggregate state is malformed", () => {
    const storage = new MapStorage();
    storage.set("triagekit.handoff.queue.v1", JSON.stringify({
      mode: "ship-it",
      missionNote: 42,
      entries: "not-an-array",
    }));

    expect(createHandoffQueue(createBrowserHandoffQueueStore(storage)).snapshot())
      .toMatchObject({ mode: "investigate", entries: [] });
  });

  it("recovers from corrupt session JSON", () => {
    const storage = new MapStorage();
    storage.set("triagekit.handoff.queue.v1", "{bad");
    expect(createBrowserHandoffQueueStore(storage).load()).toEqual({
      mode: "investigate",
      entries: [],
    });
  });
});
