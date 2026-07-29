// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  renderSelectionControls,
} from "../../src/runtime/layout/delegation/selection-controls";
import type { ScoredItem } from "../../src/runtime/layout/table/kind-renderer";

const row = (id: string): ScoredItem => ({
  id,
  provider: "github",
  providerRef: {},
  kind: "issue",
  title: id,
  location: "acme-corp/core",
  signal: 50,
  createdAt: "2026-07-29T00:00:00.000Z",
  url: `https://example.test/${id}`,
  details: {},
  score: 50,
  tier: "P2",
});

describe("delegation selection controls", () => {
  it("adds exactly the rendered focused rows", () => {
    const host = document.createElement("div");
    const added: string[][] = [];
    renderSelectionControls(host, {
      visible: [row("visible-1"), row("visible-2")],
      queuedKeys: new Set(),
      selectedCount: 0,
      totalCount: 0,
      onAddVisible: (rows) =>
        added.push(rows.map((candidate) => candidate.id)),
      onOpenQueue: () => {},
    });
    const button = host.querySelector<HTMLButtonElement>(
      "[data-add-visible]",
    )!;
    expect(button.textContent).toContain("Add visible · 2");
    expect(button.getAttribute("aria-label")).toContain("2 visible items");
    button.click();
    expect(added).toEqual([["visible-1", "visible-2"]]);
  });

  it("shows selected and retained queue counts and opens the queue", () => {
    const host = document.createElement("div");
    const onOpenQueue = vi.fn();
    renderSelectionControls(host, {
      visible: [],
      queuedKeys: new Set(),
      selectedCount: 3,
      totalCount: 5,
      onAddVisible: () => {},
      onOpenQueue,
    });
    expect(host.querySelector("[data-queue-badge]")?.textContent)
      .toContain("3 selected · 5 retained");
    host.querySelector<HTMLElement>("[data-queue-badge]")!.click();
    expect(onOpenQueue).toHaveBeenCalledOnce();
  });
});
