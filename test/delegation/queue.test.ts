import { describe, expect, it, vi } from "vitest";
import {
  createDelegationQueue,
  queueKey,
} from "../../src/runtime/delegation/queue";
import type { QueueIdentity } from "../../src/runtime/delegation/types";

const identity = (itemId: string): QueueIdentity => ({
  provider: "github",
  itemId,
  kind: "issue",
  repository: "acme-corp/core",
});

describe("delegation queue", () => {
  it("stores identity only and never removes an entry on status change", () => {
    const queue = createDelegationQueue();
    const selected = identity("github:42");
    queue.add(selected, 1_753_776_000_000);
    queue.transition(queueKey(selected), {
      status: "resolved",
      selected: false,
      reason: "No longer present after a successful slice refresh",
    });

    expect(queue.snapshot().entries).toEqual([
      expect.objectContaining({
        identity: expect.objectContaining({ itemId: "github:42" }),
        status: "resolved",
        selected: false,
      }),
    ]);
    expect(JSON.stringify(queue.serialize())).not.toContain("details");
  });

  it("adds visible identities idempotently without replacing existing status", () => {
    const queue = createDelegationQueue();
    expect(queue.addMany(
      [identity("1"), identity("2"), identity("1")],
      1000,
    )).toBe(2);
    queue.transition(queueKey(identity("1")), {
      status: "changed",
      selected: true,
      changedFields: ["title"],
    });
    expect(queue.addMany([identity("1")], 2000)).toBe(0);
    expect(queue.snapshot().entries).toHaveLength(2);
    expect(queue.snapshot().entries[0].status).toBe("changed");
  });

  it("publishes immutable snapshots after every mutation", () => {
    const queue = createDelegationQueue();
    const listener = vi.fn();
    queue.subscribe(listener);
    queue.add(identity("1"), 1000);
    queue.setSelected(queueKey(identity("1")), false);
    queue.markTransferred([queueKey(identity("1"))], 2000);

    expect(listener).toHaveBeenCalledTimes(3);
    expect(Object.isFrozen(queue.snapshot())).toBe(true);
    expect(Object.isFrozen(queue.snapshot().entries)).toBe(true);
  });
});
