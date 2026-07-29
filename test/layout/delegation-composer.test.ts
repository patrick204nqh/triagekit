// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  mountDelegationComposer,
} from "../../src/runtime/layout/delegation/composer";

function controllerWith(withError = true) {
  const snapshot = {
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
  };
  return {
    snapshot: () => snapshot,
    subscribe: () => () => {},
    open: vi.fn(),
    close: vi.fn(),
    updateIntent: vi.fn(),
    removeTarget: vi.fn(),
    revalidate: vi.fn(),
    copyBundle: vi.fn(),
    copyPackage: vi.fn(),
    downloadBundle: vi.fn(),
    downloadPackage: vi.fn(),
  } as any;
}

describe("delegation composer", () => {
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
    expect(host.querySelector("[data-copy-all]")?.textContent)
      .toContain("Copy all packages as Markdown");
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
