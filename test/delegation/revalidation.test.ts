import { describe, expect, it } from "vitest";
import type {
  DatasetSession,
  DatasetSnapshot,
  RefreshReport,
} from "../../src/runtime/cached-dataset/types";
import type { TriageItem } from "../../src/runtime/dataset/item";
import type { QueueEntry } from "../../src/runtime/delegation/types";
import {
  revalidateQueue,
} from "../../src/runtime/delegation/revalidation";

const item = (
  id: string,
  title = id,
  repository = "acme-corp/core",
): TriageItem => ({
  id,
  provider: "github",
  providerRef: {},
  kind: "issue",
  title,
  location: repository,
  signal: 50,
  createdAt: "2026-07-29T00:00:00.000Z",
  url: `https://example.test/${id}`,
  details: {},
});

const snapshotWith = (
  items: readonly TriageItem[],
  slices: DatasetSnapshot["slices"] = [],
): DatasetSnapshot => ({
  phase: "ready",
  provider: "github",
  scope: { repos: ["acme-corp/core", "acme-corp/offline"] },
  cadence: "off",
  items,
  slices,
  persistence: "indexeddb",
  warnings: [],
});

const queued = (
  itemId: string,
  repository = "acme-corp/core",
): QueueEntry => ({
  identity: {
    provider: "github",
    itemId,
    kind: "issue",
    repository,
  },
  selectedAt: 1000,
  selected: true,
  status: "queued",
});

const sessionThatRefreshes = (
  before: DatasetSnapshot,
  after: DatasetSnapshot,
  report: RefreshReport,
): DatasetSession => {
  let snapshot = before;
  return {
    snapshot: () => snapshot,
    subscribe: () => () => {},
    async refresh() {
      snapshot = after;
      return report;
    },
    available: () => [],
    perform: async () => ({ status: "rejected", message: "unused" }),
    setCadence() {},
    clearCachedData: async () => {},
    disconnect: async () => {},
  };
};

describe("delegation queue revalidation", () => {
  it("distinguishes changed, resolved, and unavailable without deleting entries", async () => {
    const before = snapshotWith([
      item("current"),
      item("changed", "old"),
      item("resolved"),
      item("offline", "stale", "acme-corp/offline"),
    ]);
    const after = snapshotWith([
      item("current"),
      item("changed", "new"),
      item("offline", "stale", "acme-corp/offline"),
    ]);
    const session = sessionThatRefreshes(before, after, {
      status: "partial",
      refreshed: [{ target: "acme-corp/core", kind: "issue" }],
      retainedStale: [{
        target: "acme-corp/offline",
        kind: "issue",
      }],
      failures: [{
        provider: "github",
        kind: "issue",
        target: "acme-corp/offline",
        category: "rate-limit",
        message: "offline",
      }],
    });

    const result = await revalidateQueue({
      entries: [
        queued("current"),
        queued("changed"),
        queued("resolved"),
        queued("offline", "acme-corp/offline"),
      ],
      before,
      session,
      project: (candidate) => ({
        id: candidate.id,
        title: candidate.title,
      }),
    });
    expect(result.transitions).toEqual(expect.arrayContaining([
      expect.objectContaining({ itemId: "current", status: "current" }),
      expect.objectContaining({
        itemId: "changed",
        status: "changed",
        changedFields: ["title"],
      }),
      expect.objectContaining({
        itemId: "resolved",
        status: "resolved",
        selected: false,
      }),
      expect.objectContaining({
        itemId: "offline",
        status: "unavailable",
        selected: true,
      }),
    ]));
  });

  it("blocks a target whose projected context contains a secret field", async () => {
    const before = snapshotWith([item("blocked")]);
    const after = snapshotWith([item("blocked")]);
    const result = await revalidateQueue({
      entries: [queued("blocked")],
      before,
      session: sessionThatRefreshes(before, after, {
        status: "complete",
        refreshed: [{ target: "acme-corp/core", kind: "issue" }],
        retainedStale: [],
        failures: [],
      }),
      project: () => ({ details: { authToken: "forbidden" } }),
    });
    expect(result.transitions[0]).toEqual(expect.objectContaining({
      itemId: "blocked",
      status: "blocked",
      selected: true,
      reason: expect.stringContaining("authToken"),
    }));
  });
});
