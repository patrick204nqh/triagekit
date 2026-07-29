// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  mountDelegationComposer,
} from "../../src/runtime/layout/delegation/composer";

function controllerWith(
  withError = true,
  overrides: Record<string, unknown> = {},
) {
  let snapshot = {
    open: true,
    selectedCount: 1,
    retainedCount: 1,
    remainingPackages: 0,
    packages: [{
      id: "pkg-core-issues",
      order: 1,
      repository: "acme-corp/core",
      kind: "issue",
      intent: {
        outcome: withError ? "" : "Triage selected issues",
        constraints: [],
        verification: [],
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
    errors: withError ? [{
      packageId: "pkg-core-issues",
      field: "intent.outcome",
      message: "Outcome must be non-empty",
    }] : [],
    previewMarkdown: "# Delegation bundle",
    canDownload: true,
    error: null,
    notice: null,
    pendingConfirmation: null,
    canUndoHandoff: false,
    busyAction: null,
    needsAttention: [],
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
    updateIntent: vi.fn(),
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

describe("delegation composer", () => {
  it("presents one clear bundle action and progressive download options", () => {
    const host = document.createElement("div");
    mountDelegationComposer(host, controllerWith(false));

    expect(host.querySelector("[data-copy-all]")?.textContent)
      .toContain("Copy next bundle — 1 package, 1 target");
    expect(host.querySelector("[data-copy-package]")).toBeNull();
    expect(host.querySelector("[data-download-menu]")).toBeTruthy();
    expect(host.querySelectorAll("[data-download-all]")).toHaveLength(2);
    expect(host.querySelector("[data-revalidate]")?.textContent)
      .toBe("Check again");
    expect(host.querySelector("[data-remove-target]")?.textContent)
      .toBe("Deselect");
  });

  it("explains that export preserved the queue and offers confirmation", () => {
    const host = document.createElement("div");
    const controller = controllerWith(false, {
      notice: {
        tone: "success",
        message: "Copied 1 package · 1 target · queue unchanged",
      },
      pendingConfirmation: { packageCount: 1, targetCount: 1 },
    });
    mountDelegationComposer(host, controller);

    expect(host.querySelector("[data-delegation-notice]")?.textContent)
      .toContain("queue unchanged");
    host.querySelector<HTMLElement>("[data-confirm-handoff]")!.click();
    expect(controller.confirmHandoff).toHaveBeenCalledOnce();
  });

  it("preserves field focus and selection across controller updates", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const controller = controllerWith(false);
    mountDelegationComposer(host, controller);
    const outcome = host.querySelector<HTMLTextAreaElement>(
      "#pkg-core-issues-intent-outcome",
    )!;
    outcome.focus();
    outcome.setSelectionRange(3, 8);

    controller.emit({
      notice: { tone: "info", message: "Checking 1 target…" },
    });

    const rerendered = host.querySelector<HTMLTextAreaElement>(
      "#pkg-core-issues-intent-outcome",
    )!;
    expect(document.activeElement).toBe(rerendered);
    expect([rerendered.selectionStart, rerendered.selectionEnd])
      .toEqual([3, 8]);
  });

  it("keeps handed-off targets inspectable and removable", () => {
    const host = document.createElement("div");
    const controller = controllerWith(false, {
      handedOff: [{
        key: "github:issue:acme-corp/core:github:42",
        itemId: "github:42",
        title: "Issue 42",
        repository: "acme-corp/core",
        kind: "issue",
        status: "transferred",
        transferredAt: Date.UTC(2026, 6, 29, 10, 30),
      }],
    });
    mountDelegationComposer(host, controller);

    expect(host.querySelector("[data-queue-section='handed-off'] summary")
      ?.textContent).toContain("Handed off · 1");
    expect(host.querySelector("[data-queue-history-item]")?.textContent)
      .toContain("Issue 42");
    host.querySelector<HTMLElement>("[data-remove-queue-item]")!.click();
    expect(controller.removeQueueItem).toHaveBeenCalledWith(
      "github:issue:acme-corp/core:github:42",
    );
  });

  it("restores dashboard interaction when the composer closes", () => {
    document.body.innerHTML = "";
    const dashboard = document.createElement("main");
    const host = document.createElement("div");
    document.body.append(dashboard, host);
    const controller = controllerWith(false);

    mountDelegationComposer(host, controller);
    expect(dashboard.hasAttribute("inert")).toBe(true);

    host.querySelector<HTMLElement>("[data-delegation-close]")!.click();

    expect(host.childElementCount).toBe(0);
    expect(dashboard.hasAttribute("inert")).toBe(false);
    expect(document.querySelector("[data-delegation-scrim]")).toBeNull();
  });

  it("renders one compact review surface with linked package errors", () => {
    const host = document.createElement("div");
    document.body.append(host);
    mountDelegationComposer(host, controllerWith());
    expect(host.querySelector(
      '[role="dialog"][aria-modal="true"]',
    )).toBeTruthy();
    expect(host.querySelector('[aria-live="polite"]')).toBeTruthy();
    const error = host.querySelector<HTMLAnchorElement>(
      '[data-package-error="pkg-core-issues"]',
    )!;
    expect(error.getAttribute("href"))
      .toBe("#pkg-core-issues-intent-outcome");
    const outcome = host.querySelector<HTMLTextAreaElement>(
      "#pkg-core-issues-intent-outcome",
    )!;
    expect(outcome.getAttribute("aria-invalid")).toBe("true");
    expect(outcome.getAttribute("aria-describedby")).toBe(
      "pkg-core-issues-error-0",
    );
    expect(host.querySelector("[data-copy-all]")?.textContent)
      .toContain("Copy next bundle");
  });

  it("wires intent edits and package actions to the controller", () => {
    const host = document.createElement("div");
    const controller = controllerWith(false);
    mountDelegationComposer(host, controller);
    const outcome = host.querySelector<HTMLTextAreaElement>(
      "#pkg-core-issues-intent-outcome",
    )!;
    outcome.value = "Triage selected issues";
    outcome.dispatchEvent(new Event("change"));
    expect(controller.updateIntent).toHaveBeenCalledWith(
      "pkg-core-issues",
      expect.objectContaining({ outcome: "Triage selected issues" }),
    );
    host.querySelector<HTMLElement>("[data-copy-all]")!.click();
    expect(controller.copyBundle).toHaveBeenCalledOnce();
  });
});
