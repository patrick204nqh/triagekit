// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BriefSurface } from "../../src/runtime/handoff/brief-surface";
import type { AgentHandoffV1 } from "../../src/runtime/handoff/types";

function sample(): AgentHandoffV1 {
  return {
    schema: "triagekit.agent-handoff",
    version: 1,
    createdAt: "2026-07-27T00:00:00.000Z",
    intent: { outcome: "Fix the vuln", constraints: [], verification: [] },
    targets: [{
      id: "gh:42", kind: "dependency-vuln", provider: "github",
      providerReference: { alertNumber: 42 },
      title: "lodash", location: "acme/app",
      url: "https://github.com/acme/app/security/42",
      createdAt: "2026-07-26T00:00:00.000Z",
      priority: { signal: 80, score: 85, tier: "P0" },
      details: {},
    }],
    context: { session: { kind: "dependency-vuln", provider: "github", repository: "acme/app" }, relatedItems: [] },
  };
}

describe("BriefSurface", () => {
  let container: HTMLElement;
  let surface: BriefSurface;
  let callbacks: ReturnType<typeof vi.mocked>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    surface = new BriefSurface();
    surface.mount(container);
    callbacks = {
      onOutcomeChange: vi.fn(),
      onConstraintChange: vi.fn(),
      onVerificationChange: vi.fn(),
      onCopy: vi.fn(),
      onDownloadMarkdown: vi.fn(),
      onDownloadJSON: vi.fn(),
      onClose: vi.fn(),
    } as any;
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("opens and shows the preview", () => {
    surface.open(sample(), callbacks);
    expect(surface["drawer"].hidden).toBe(false);
    expect(surface["scrim"].hidden).toBe(false);
    expect(surface["drawer"].textContent).toContain("Agent Brief");
  });

  it("closes and hides elements", () => {
    surface.open(sample(), callbacks);
    surface.close();
    expect(surface["drawer"].hidden).toBe(true);
    expect(surface["scrim"].hidden).toBe(true);
  });

  it("calls onClose when scrim is clicked", () => {
    surface.open(sample(), callbacks);
    surface["scrim"].click();
    expect(callbacks.onClose).toHaveBeenCalled();
  });

  it("calls onCopy when copy button is clicked", () => {
    surface.open(sample(), callbacks);
    (surface["drawer"].querySelector("[data-copy]") as HTMLElement).click();
    expect(callbacks.onCopy).toHaveBeenCalled();
  });

  it("shows status message", () => {
    surface.showStatus("Copied!");
    expect(surface["status"].textContent).toBe("Copied!");
  });

  it("renders editable outcome", () => {
    surface.open(sample(), callbacks);
    const textarea = surface["drawer"].querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    expect(textarea.value).toBe("Fix the vuln");
    textarea.value = "New outcome";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    expect(callbacks.onOutcomeChange).toHaveBeenCalledWith("New outcome");
  });
});
