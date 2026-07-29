import { describe, expect, it, vi } from "vitest";
import {
  createDelegationController,
} from "../../src/runtime/delegation/controller";
import {
  createDelegationQueue,
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

function fixture(input: { count?: number; clipboardError?: string } = {}) {
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
  });
  return { controller, clipboard, downloads, queue };
}

describe("delegation controller", () => {
  it("copies five packages, marks transferred targets, and leaves remainder queued", async () => {
    const { controller, clipboard, queue } = fixture({ count: 56 });
    const result = await controller.copyBundle();
    expect(result).toEqual({ ok: true });
    const copied = clipboard.writeText.mock.calls[0][0];
    expect(copied.match(/^## Package /gm)).toHaveLength(5);
    expect(queue.snapshot().entries.filter((entry) =>
      entry.status === "transferred")).toHaveLength(50);
    expect(controller.snapshot().remainingPackages).toBeGreaterThan(0);
  });

  it("keeps preview and downloads available after clipboard denial", async () => {
    const { controller } = fixture({ clipboardError: "denied" });
    expect(await controller.copyBundle()).toEqual({
      ok: false,
      error: "denied",
    });
    expect(controller.snapshot().previewMarkdown).toContain(
      "# Delegation bundle",
    );
    expect(controller.snapshot().canDownload).toBe(true);
  });
});
