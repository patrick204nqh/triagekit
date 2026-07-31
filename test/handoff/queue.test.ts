import { describe, expect, it, vi } from "vitest";
import {
  createHandoffQueue,
  isReadyForHandoff,
  queueKey,
} from "../../src/runtime/handoff/queue";
import type {
  HandoffIdentity,
  HandoffQueueEntry,
} from "../../src/runtime/handoff/types";

const identity = (itemId: string): HandoffIdentity => ({
  provider: "github",
  itemId,
  kind: "issue",
  repository: "acme-corp/core",
});

const queueEntry = (
  over: Partial<HandoffQueueEntry>,
): HandoffQueueEntry => ({
  identity: identity("ready-test"),
  selectedAt: 1000,
  selected: true,
  status: "queued",
  ...over,
});

describe("handoff queue", () => {
  it.each([
    ["queued", true],
    ["current", true],
    ["changed", true],
    ["checking", false],
    ["resolved", false],
    ["unavailable", false],
    ["blocked", false],
    ["transferred", false],
  ] as const)("treats %s readiness as %s", (status, expected) => {
    expect(isReadyForHandoff(queueEntry({ status, selected: true })))
      .toBe(expected);
  });

  it("requires explicit selection for readiness", () => {
    expect(isReadyForHandoff(queueEntry({
      status: "current",
      selected: false,
    }))).toBe(false);
  });

  it("defaults a new queue to investigate with no notes", () => {
    const queue = createHandoffQueue();

    expect(queue.snapshot()).toMatchObject({
      mode: "investigate",
      missionNote: undefined,
      selectedCount: 0,
    });
  });

  it("changes mode without changing membership or notes", () => {
    const queue = createHandoffQueue();
    queue.add(identity("github:42"), 100);
    const key = queueKey(identity("github:42"));
    queue.setMissionNote("Keep public APIs stable");
    queue.setItemNote(key, "The failing snapshot is unrelated");

    expect(queue.setMode("implement")).toBe(true);
    expect(queue.snapshot()).toMatchObject({
      mode: "implement",
      missionNote: "Keep public APIs stable",
      selectedCount: 1,
    });
    expect(queue.snapshot().entries[0].note)
      .toBe("The failing snapshot is unrelated");
  });

  it("normalizes empty human notes away", () => {
    const queue = createHandoffQueue();
    queue.add(identity("github:42"), 100);
    const key = queueKey(identity("github:42"));

    queue.setMissionNote("  Verify the regression test  ");
    queue.setItemNote(key, "  Do not change the public type  ");
    expect(queue.snapshot().missionNote).toBe("Verify the regression test");
    expect(queue.snapshot().entries[0].note)
      .toBe("Do not change the public type");

    queue.setMissionNote("  ");
    queue.setItemNote(key, "\n");
    expect(queue.snapshot().missionNote).toBeUndefined();
    expect(queue.snapshot().entries[0].note).toBeUndefined();
  });

  it("stores identity only and never removes an entry on status change", () => {
    const queue = createHandoffQueue();
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
    const queue = createHandoffQueue();
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
    const queue = createHandoffQueue();
    const listener = vi.fn();
    queue.subscribe(listener);
    queue.add(identity("1"), 1000);
    queue.setSelected(queueKey(identity("1")), false);
    queue.markTransferred([queueKey(identity("1"))], 2000);

    expect(listener).toHaveBeenCalledTimes(3);
    expect(Object.isFrozen(queue.snapshot())).toBe(true);
    expect(Object.isFrozen(queue.snapshot().entries)).toBe(true);
  });

  it("applies a transition batch with one published snapshot", () => {
    const queue = createHandoffQueue();
    queue.addMany([identity("1"), identity("2")], 1000);
    const listener = vi.fn();
    queue.subscribe(listener);

    expect(queue.transitionMany([
      {
        key: queueKey(identity("1")),
        transition: { status: "current", selected: true },
      },
      {
        key: queueKey(identity("2")),
        transition: {
          status: "blocked",
          selected: false,
          reason: "Unsafe source field omitted",
        },
      },
    ])).toBe(2);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(queue.snapshot().entries.map((entry) => ({
      itemId: entry.identity.itemId,
      status: entry.status,
      selected: entry.selected,
    }))).toEqual([
      { itemId: "1", status: "current", selected: true },
      { itemId: "2", status: "blocked", selected: false },
    ]);
  });

  it("selects and deselects identity batches with one published snapshot", () => {
    const queue = createHandoffQueue();
    const retained = identity("retained");
    queue.add(retained, 1000);
    queue.transition(queueKey(retained), {
      status: "changed",
      selected: false,
    });
    const listener = vi.fn();
    queue.subscribe(listener);

    expect(queue.setSelectedMany(
      [retained, identity("new"), identity("new")],
      true,
      2000,
    )).toBe(2);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(queue.snapshot().entries).toEqual([
      expect.objectContaining({
        identity: expect.objectContaining({ itemId: "retained" }),
        status: "changed",
        selected: true,
        selectedAt: 1000,
      }),
      expect.objectContaining({
        identity: expect.objectContaining({ itemId: "new" }),
        status: "queued",
        selected: true,
        selectedAt: 2000,
      }),
    ]);

    listener.mockClear();
    expect(queue.setSelectedMany(
      [retained, identity("new"), identity("missing")],
      false,
      3000,
    )).toBe(2);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(queue.snapshot().entries).toHaveLength(2);
    expect(queue.snapshot().entries.every((entry) => !entry.selected)).toBe(true);
    expect(queue.snapshot().entries[0]).toMatchObject({
      status: "changed",
      selectedAt: 1000,
    });
  });

  it("returns a handed-off target to Ready when selected again", () => {
    const queue = createHandoffQueue();
    const target = identity("handed-off");
    queue.add(target, 1000);
    queue.markTransferred([queueKey(target)], 2000);

    expect(queue.setSelected(queueKey(target), true)).toBe(true);
    expect(queue.snapshot().entries[0]).toEqual(expect.objectContaining({
      selected: true,
      status: "queued",
    }));
    expect(queue.snapshot().entries[0].transferredAt).toBeUndefined();
  });
});
