// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  mountHandoffComposer,
} from "../../src/runtime/layout/delegation/composer";

function controllerWith(overrides: Record<string, unknown> = {}) {
  let snapshot = {
    open: true,
    mode: "investigate",
    missionNote: undefined,
    selectedCount: 1,
    retainedCount: 1,
    remainingPackages: 0,
    packages: [{
      id: "pkg-core-issues",
      order: 1,
      repository: "acme-corp/core",
      kind: "issue",
      generatedIntent: {
        outcome: "Investigate the selected issues",
        constraints: ["Do not modify files."],
        verification: ["Outline a concrete action plan."],
      },
      intent: {
        outcome: "Investigate the selected issues",
        constraints: ["Do not modify files."],
        verification: ["Outline a concrete action plan."],
      },
      targets: [{
        id: "github:42",
        title: "Issue 42",
        kind: "issue",
        location: "acme-corp/core",
        priority: { tier: "P1", score: 90, signal: 80 },
        details: {},
      }],
      selectionReason: "Repository priority 1",
    }],
    errors: [],
    previewMarkdown: "# Handoff bundle",
    canDownload: true,
    error: null,
    notice: null,
    pendingConfirmation: null,
    canUndoHandoff: false,
    busyAction: null,
    notInNextBundle: [],
    handedOff: [],
    ...overrides,
  };
  const listeners = new Set<(value: typeof snapshot) => void>();
  return {
    snapshot: () => snapshot,
    subscribe: (listener: (value: typeof snapshot) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    open: vi.fn(),
    close: vi.fn(() => {
      snapshot = { ...snapshot, open: false };
      listeners.forEach((listener) => listener(snapshot));
    }),
    setMode: vi.fn(),
    setMissionNote: vi.fn(),
    setItemNote: vi.fn(),
    removeTarget: vi.fn(),
    removeQueueItem: vi.fn(),
    revalidate: vi.fn(),
    copyBundle: vi.fn(),
    copyPackage: vi.fn(),
    confirmHandoff: vi.fn(),
    undoHandoff: vi.fn(),
    downloadBundle: vi.fn(),
    downloadPackage: vi.fn(),
    emit(next: Record<string, unknown>) {
      snapshot = { ...snapshot, ...next };
      listeners.forEach((listener) => listener(snapshot));
    },
  } as any;
}

describe("Handoff composer", () => {
  it("shows a safe default without package prompt fields", () => {
    const host = document.createElement("div");
    mountHandoffComposer(host, controllerWith());

    expect(host.querySelector("h2")?.textContent).toBe("Handoff queue");
    expect(host.querySelector<HTMLInputElement>(
      "[name='handoff-mode'][value='investigate']",
    )?.checked).toBe(true);
    expect(host.textContent).toContain(
      "Analyze and propose a plan. Make no changes.",
    );
    expect(host.querySelector("[data-intent-outcome]")).toBeNull();
    expect(host.querySelector("[data-intent-constraints]")).toBeNull();
    expect(host.querySelector("[data-intent-verification]")).toBeNull();
    expect(host.querySelector("[data-copy-all]")?.textContent)
      .toBe("Copy investigation handoff");
  });

  it("changes mode and mission note through accessible controls", () => {
    const host = document.createElement("div");
    const controller = controllerWith();
    mountHandoffComposer(host, controller);

    host.querySelector<HTMLInputElement>(
      "[name='handoff-mode'][value='implement']",
    )!.click();
    expect(controller.setMode).toHaveBeenCalledWith("implement");

    const note = host.querySelector<HTMLTextAreaElement>(
      "[data-mission-note]",
    )!;
    note.value = "Keep public APIs stable";
    note.dispatchEvent(new Event("change"));
    expect(controller.setMissionNote)
      .toHaveBeenCalledWith("Keep public APIs stable");
  });

  it("adds and edits an item exception note", () => {
    const host = document.createElement("div");
    const controller = controllerWith();
    mountHandoffComposer(host, controller);

    host.querySelector<HTMLElement>("[data-add-item-note='github:42']")!
      .click();
    const field = host.querySelector<HTMLTextAreaElement>(
      "[data-item-note='github:42']",
    )!;
    field.value = "Do not update beyond v4";
    field.dispatchEvent(new Event("change"));
    expect(controller.setItemNote)
      .toHaveBeenCalledWith("github:42", "Do not update beyond v4");
  });

  it("shows an existing item note inline as editable context", () => {
    const host = document.createElement("div");
    const controller = controllerWith({
      packages: [{
        ...controllerWith().snapshot().packages[0],
        targets: [{
          ...controllerWith().snapshot().packages[0].targets[0],
          note: "The flaky test is unrelated",
        }],
      }],
    });
    mountHandoffComposer(host, controller);

    expect(host.querySelector<HTMLTextAreaElement>(
      "[data-item-note='github:42']",
    )?.value).toBe("The flaky test is unrelated");
    expect(host.querySelector("[data-add-item-note='github:42']")?.textContent)
      .toBe("Edit note");
  });

  it("keeps the dialog and body mounted across copy updates", () => {
    const host = document.createElement("div");
    const controller = controllerWith();
    mountHandoffComposer(host, controller);
    const dialog = host.querySelector("[role='dialog']");
    const body = host.querySelector(".delegation-composer-body");

    controller.emit({
      busyAction: "copy",
      notice: { tone: "info", message: "Copying handoff…" },
    });
    controller.emit({
      busyAction: null,
      notice: {
        tone: "success",
        message: "Copied 1 package · 1 target · queue unchanged",
      },
    });

    expect(host.querySelector("[role='dialog']")).toBe(dialog);
    expect(host.querySelector(".delegation-composer-body")).toBe(body);
    expect(host.querySelector("[data-delegation-notice]")?.textContent)
      .toContain("queue unchanged");
  });

  it("preserves mission note focus and selection across updates", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const controller = controllerWith({
      missionNote: "Keep public APIs stable",
    });
    mountHandoffComposer(host, controller);
    const note = host.querySelector<HTMLTextAreaElement>(
      "[data-mission-note]",
    )!;
    note.focus();
    note.setSelectionRange(3, 8);

    controller.emit({
      notice: { tone: "info", message: "Checking 1 target…" },
    });

    const rerendered = host.querySelector<HTMLTextAreaElement>(
      "[data-mission-note]",
    )!;
    expect(document.activeElement).toBe(rerendered);
    expect([rerendered.selectionStart, rerendered.selectionEnd])
      .toEqual([3, 8]);
  });

  it("keeps handed-off and exceptional targets actionable", () => {
    const host = document.createElement("div");
    const controller = controllerWith({
      handedOff: [{
        key: "handed-off-key",
        itemId: "github:42",
        title: "Issue 42",
        repository: "acme-corp/core",
        kind: "issue",
        status: "transferred",
      }],
      notInNextBundle: [{
        key: "blocked-key",
        itemId: "github:blocked",
        title: "Blocked issue",
        repository: "acme-corp/core",
        kind: "issue",
        status: "blocked",
        reason: "Target projection failed",
      }],
    });
    mountHandoffComposer(host, controller);

    expect(host.textContent).toContain("Handed off · 1");
    expect(host.textContent).toContain("Not in next bundle · 1");
    host.querySelector<HTMLElement>(
      "[data-remove-queue-item='handed-off-key']",
    )!.click();
    expect(controller.removeQueueItem)
      .toHaveBeenCalledWith("handed-off-key");
    host.querySelector<HTMLElement>(
      "[data-remove-target='github:blocked']",
    )!.click();
    expect(controller.removeTarget).toHaveBeenCalledWith("github:blocked");
  });

  it("restores dashboard interaction when the composer closes", () => {
    document.body.innerHTML = "";
    const dashboard = document.createElement("main");
    const host = document.createElement("div");
    document.body.append(dashboard, host);
    const controller = controllerWith();

    mountHandoffComposer(host, controller);
    expect(dashboard.hasAttribute("inert")).toBe(true);

    host.querySelector<HTMLElement>("[data-delegation-close]")!.click();

    expect(host.childElementCount).toBe(0);
    expect(dashboard.hasAttribute("inert")).toBe(false);
  });

  it("keeps transfer, download, revalidation, and confirmation controls", () => {
    const host = document.createElement("div");
    const controller = controllerWith({
      pendingConfirmation: { packageCount: 1, targetCount: 1 },
    });
    mountHandoffComposer(host, controller);

    expect(host.querySelector("[data-download-menu]")).toBeTruthy();
    expect(host.querySelectorAll("[data-download-all]")).toHaveLength(2);
    expect(host.querySelector("[data-revalidate]")?.textContent)
      .toBe("Check again");
    host.querySelector<HTMLElement>("[data-confirm-handoff]")!.click();
    expect(controller.confirmHandoff).toHaveBeenCalledOnce();
    host.querySelector<HTMLElement>("[data-copy-all]")!.click();
    expect(controller.copyBundle).toHaveBeenCalledOnce();
  });
});
