import { describe, expect, it, vi } from "vitest";
import {
  createDelegationController,
} from "../../src/runtime/delegation/controller";
import {
  createDelegationQueue,
  queueKey,
} from "../../src/runtime/delegation/queue";
import type { ScoredItem } from "../../src/runtime/layout/table/kind-renderer";
import { runtimeCatalog } from "../../src/runtime/catalog/built-in";

const items = (count: number): ScoredItem[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `github:issue:${String(index).padStart(2, "0")}`,
    provider: "github",
    providerRef: { number: index + 1 },
    kind: "issue",
    title: `Issue ${index + 1}`,
    location: "acme-corp/core",
    signal: 100 - index,
    createdAt: "2026-07-29T00:00:00.000Z",
    url: `https://example.test/issues/${index + 1}`,
    details: {
      number: index + 1,
      state: "open",
      body: "",
      author: { login: "alice", avatarUrl: "", kind: "human" },
      assignees: [],
      reviewers: [],
      comments: 0,
      labels: [],
      checks: null,
      permalinks: [],
      relations: [],
    },
    score: 100 - index,
    tier: index < 10 ? "P0" : index < 30 ? "P1" : "P2",
  }));

function fixture(input: {
  count?: number;
  clipboardError?: string;
  clipboardPromise?: Promise<void>;
  revalidate?: boolean;
  revalidateError?: string;
} = {}) {
  const rows = items(input.count ?? 2);
  const queue = createDelegationQueue();
  queue.addMany(rows.map((item) => ({
    provider: item.provider,
    itemId: item.id,
    kind: item.kind,
    repository: item.location,
  })), 1000);
  const clipboard = {
    writeText: input.clipboardError
      ? vi.fn().mockRejectedValue(new Error(input.clipboardError))
      : input.clipboardPromise
      ? vi.fn().mockReturnValue(input.clipboardPromise)
      : vi.fn().mockResolvedValue(undefined),
  };
  const downloads = {
    text: vi.fn(() => ({ ok: true as const })),
    json: vi.fn(() => ({ ok: true as const })),
  };
  const controller = createDelegationController({
    queue,
    items: () => rows,
    focusPolicy: () => ({
      provider: "github",
      repositoryOrder: ["acme-corp/core"],
      labels: { include: [], exclude: [], enabled: true },
    }),
    catalog: runtimeCatalog,
    scoreExplain: () => null,
    clock: () => new Date("2026-07-29T00:00:00.000Z"),
    clipboard,
    downloads,
    ...(input.revalidate || input.revalidateError
      ? {
          revalidateQueue: input.revalidateError
            ? vi.fn().mockRejectedValue(new Error(input.revalidateError))
            : vi.fn().mockResolvedValue({
                transitions: rows.map((item) => ({
                  key: queueKey({
                    provider: item.provider,
                    itemId: item.id,
                    kind: item.kind,
                    repository: item.location,
                  }),
                  itemId: item.id,
                  status: "current" as const,
                  selected: true,
                })),
              }),
        }
      : {}),
  });
  return { controller, clipboard, downloads, queue };
}

describe("delegation controller", () => {
  it("copies the next bundle without changing queue membership", async () => {
    const { controller, clipboard, queue } = fixture({ count: 56 });
    const result = await controller.copyBundle();
    expect(result).toEqual({ ok: true });
    const copied = clipboard.writeText.mock.calls[0][0];
    expect(copied.match(/^## Package /gm)).toHaveLength(5);
    expect(queue.snapshot().entries.filter((entry) =>
      entry.status === "transferred")).toHaveLength(0);
    expect(queue.snapshot().selectedCount).toBe(56);
    expect(controller.snapshot().notice).toEqual({
      tone: "success",
      message: "Copied 5 packages · 50 targets · queue unchanged",
    });
    expect(controller.snapshot().pendingConfirmation).toEqual({
      packageCount: 5,
      targetCount: 50,
    });
    expect(controller.snapshot().remainingPackages).toBeGreaterThan(0);
  });

  it("moves copied targets only after confirmation and can undo", async () => {
    const { controller, queue } = fixture({ count: 56 });
    await controller.copyBundle();

    expect(controller.confirmHandoff()).toBe(true);
    expect(queue.snapshot().entries.filter((entry) =>
      entry.status === "transferred")).toHaveLength(50);
    expect(queue.snapshot().selectedCount).toBe(6);
    expect(controller.snapshot().pendingConfirmation).toBeNull();
    expect(controller.snapshot().canUndoHandoff).toBe(true);

    expect(controller.undoHandoff()).toBe(true);
    expect(queue.snapshot().entries.filter((entry) =>
      entry.status === "transferred")).toHaveLength(0);
    expect(queue.snapshot().selectedCount).toBe(56);
    expect(controller.snapshot().canUndoHandoff).toBe(false);
  });

  it("exposes handed-off history and lets the user remove retained entries", async () => {
    const { controller, queue } = fixture();
    await controller.copyBundle();
    controller.confirmHandoff();

    expect(controller.snapshot().handedOff).toHaveLength(2);
    const handedOffKey = controller.snapshot().handedOff[0].key;
    expect(controller.removeQueueItem(handedOffKey)).toBe(true);
    expect(queue.snapshot().entries).toHaveLength(1);
    expect(controller.snapshot().handedOff).toHaveLength(1);
  });

  it("separates actionable exceptions from manual deselection", () => {
    const { controller, queue } = fixture({ count: 3 });
    const entries = queue.snapshot().entries;
    queue.transition(queueKey(entries[0].identity), {
      status: "blocked",
      selected: true,
      reason: "Target projection failed",
    });
    queue.transition(queueKey(entries[1].identity), {
      status: "unavailable",
      selected: true,
      reason: "Refresh failed",
    });
    queue.transition(queueKey(entries[2].identity), {
      status: "current",
      selected: false,
    });

    expect(controller.snapshot().notInNextBundle.map((entry) =>
      entry.status)).toEqual(["blocked", "unavailable"]);
    expect(controller.snapshot().packages).toHaveLength(0);

    queue.transition(queueKey(entries[2].identity), {
      status: "resolved",
      selected: false,
      reason: "No longer present",
    });
    expect(controller.snapshot().notInNextBundle.map((entry) =>
      entry.status)).toEqual(["blocked", "unavailable", "resolved"]);
  });

  it("downloads artifacts without changing queue membership", () => {
    const bundleFixture = fixture();
    expect(bundleFixture.controller.downloadBundle("json"))
      .toEqual({ ok: true });
    expect(bundleFixture.downloads.json).toHaveBeenCalledOnce();
    expect(bundleFixture.queue.snapshot().selectedCount).toBe(2);
    expect(bundleFixture.controller.snapshot().notice).toEqual({
      tone: "success",
      message: "Downloaded 1 package · 2 targets · queue unchanged",
    });

    const packageFixture = fixture();
    const packageId = packageFixture.controller.snapshot().packages[0].id;
    expect(packageFixture.controller.downloadPackage(packageId, "md"))
      .toEqual({ ok: true });
    expect(packageFixture.downloads.text).toHaveBeenCalledOnce();
    expect(packageFixture.queue.snapshot().selectedCount).toBe(2);
    expect(packageFixture.controller.snapshot().pendingConfirmation)
      .toEqual({ packageCount: 1, targetCount: 2 });
  });

  it("disables and rejects downloads while the bundle is invalid", () => {
    const { controller, downloads } = fixture();
    const packageId = controller.snapshot().packages[0].id;
    controller.updateIntent(packageId, { outcome: "" });

    expect(controller.snapshot().canDownload).toBe(false);
    expect(controller.downloadBundle("md")).toEqual({
      ok: false,
      error: "Fix package validation errors before transfer",
    });
    expect(downloads.text).not.toHaveBeenCalled();
    expect(controller.snapshot().notice?.tone).toBe("error");
    expect(controller.downloadPackage(packageId, "json")).toEqual({
      ok: false,
      error: "Fix package validation errors before transfer",
    });
    expect(downloads.json).not.toHaveBeenCalled();
  });

  it("keeps preview and downloads available after clipboard denial", async () => {
    const { controller } = fixture({ clipboardError: "denied" });
    expect(await controller.copyBundle()).toEqual({
      ok: false,
      error: "denied",
    });
    expect(controller.snapshot().previewMarkdown).toContain(
      "# Handoff bundle",
    );
    expect(controller.snapshot().canDownload).toBe(true);
  });

  it("exposes clipboard progress while the copy is pending", async () => {
    let resolveCopy!: () => void;
    const clipboardPromise = new Promise<void>((resolve) => {
      resolveCopy = resolve;
    });
    const { controller } = fixture({ clipboardPromise });

    const copy = controller.copyBundle();
    expect(controller.snapshot().busyAction).toBe("copy");

    resolveCopy();
    await copy;
    expect(controller.snapshot().busyAction).toBeNull();
  });

  it("publishes one checking and one final snapshot during revalidation", async () => {
    const { controller } = fixture({ count: 56, revalidate: true });
    const listener = vi.fn();
    controller.subscribe(listener);

    await controller.revalidate();

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("restores queue state when revalidation fails", async () => {
    const { controller, queue } = fixture({
      count: 2,
      revalidateError: "Network unavailable",
    });

    await controller.revalidate();

    expect(queue.snapshot().entries.every((entry) =>
      entry.status === "queued" && entry.selected)).toBe(true);
    expect(controller.snapshot().busyAction).toBeNull();
    expect(controller.snapshot().notice).toEqual({
      tone: "error",
      message: "Could not check targets: Network unavailable",
    });
  });
});
