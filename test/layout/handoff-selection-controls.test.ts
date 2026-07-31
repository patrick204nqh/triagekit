// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  handoffIdentityForItem,
  renderSelectionControls,
} from "../../src/runtime/layout/handoff/selection-controls";
import type { ScoredItem } from "../../src/runtime/layout/table/kind-renderer";
import { queueKey } from "../../src/runtime/handoff/queue";

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

describe("Handoff selection controls", () => {
  it("toggles only visible rows through unchecked, mixed, and checked states", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const visible = [row("visible-1"), row("visible-2")];
    const hidden = row("hidden");
    const onSetVisible = vi.fn();

    renderSelectionControls(host, {
      visible,
      queuedKeys: new Set(),
      readyCount: 0,
      onSetVisible,
      onOpenQueue: () => {},
    });
    let input = host.querySelector<HTMLInputElement>(
      "[data-toggle-visible]",
    )!;
    expect(input.checked).toBe(false);
    expect(input.indeterminate).toBe(false);
    input.click();
    expect(onSetVisible).toHaveBeenLastCalledWith(visible, true);

    renderSelectionControls(host, {
      visible,
      queuedKeys: new Set([queueKey(handoffIdentityForItem(visible[0]))]),
      readyCount: 1,
      onSetVisible,
      onOpenQueue: () => {},
    });
    input = host.querySelector("[data-toggle-visible]")!;
    expect(input.checked).toBe(false);
    expect(input.indeterminate).toBe(true);
    expect(input.getAttribute("aria-checked")).toBe("mixed");
    input.click();
    expect(onSetVisible).toHaveBeenLastCalledWith(visible, true);

    renderSelectionControls(host, {
      visible,
      queuedKeys: new Set([
        ...visible.map((candidate) =>
          queueKey(handoffIdentityForItem(candidate))),
        queueKey(handoffIdentityForItem(hidden)),
      ]),
      readyCount: 3,
      onSetVisible,
      onOpenQueue: () => {},
    });
    input = host.querySelector("[data-toggle-visible]")!;
    expect(input.checked).toBe(true);
    expect(input.indeterminate).toBe(false);
    input.click();
    expect(onSetVisible).toHaveBeenLastCalledWith(visible, false);
    expect(onSetVisible.mock.calls.flatMap(([rows]) =>
      rows.map((candidate: ScoredItem) => candidate.id)))
      .not.toContain("hidden");

    renderSelectionControls(host, {
      visible: [],
      queuedKeys: new Set(),
      readyCount: 0,
      onSetVisible,
      onOpenQueue: () => {},
    });
    expect(
      host.querySelector<HTMLInputElement>("[data-toggle-visible]")!.disabled,
    ).toBe(true);
  });

  it.each([
    [0, "Handoff", "Open Handoff queue"],
    [3, "Handoff · 3 ready", "Open Handoff queue: 3 ready"],
  ] as const)("shows operator-ready copy for %s items", (readyCount, text, label) => {
    const host = document.createElement("div");
    const onOpenQueue = vi.fn();
    renderSelectionControls(host, {
      visible: [],
      queuedKeys: new Set(),
      readyCount,
      onSetVisible: () => {},
      onOpenQueue,
    });
    const button = host.querySelector("[data-queue-badge]");
    expect(button?.textContent).toBe(text);
    expect(button?.getAttribute("aria-label")).toBe(label);
    expect(button?.textContent).not.toMatch(/selected|retained/i);
    expect(button?.getAttribute("aria-label")).not.toMatch(/selected|retained/i);
    host.querySelector<HTMLElement>("[data-queue-badge]")!.click();
    expect(onOpenQueue).toHaveBeenCalledOnce();
  });
});
