// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BriefSurface } from "../../src/runtime/handoff/brief-surface";
import type { AgentHandoffV1 } from "../../src/runtime/handoff/types";

function sample(): AgentHandoffV1 {
  return {
    schema: "triagekit.agent-handoff",
    version: 1,
    createdAt: "2026-07-27T00:00:00.000Z",
    intent: { outcome: "Fix the vuln", constraints: ["Don't force-push"], verification: ["Tests pass"] },
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
      onCopy: vi.fn(),
      onDownloadMarkdown: vi.fn(),
      onDownloadJSON: vi.fn(),
      onClose: vi.fn(),
    } as any;
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("opens and shows the drawer", () => {
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

  it("shows item identity in head meta", () => {
    surface.open(sample(), callbacks);
    expect(surface["headMeta"].textContent).toContain("dependency-vuln");
    expect(surface["headMeta"].textContent).toContain("lodash");
    expect(surface["headMeta"].textContent).toContain("P0");
  });

  it("shows disclosure text", () => {
    surface.open(sample(), callbacks);
    expect(surface["drawer"].querySelector(".brief-disclosure")!.textContent)
      .toContain("does not contain your GitHub token");
  });

  it("shows outcome", () => {
    surface.open(sample(), callbacks);
    expect(surface["drawer"].querySelector(".brief-outcome")!.textContent)
      .toContain("Fix the vuln");
  });

  it("shows raw markdown preview", () => {
    surface.open(sample(), callbacks);
    const raw = surface["drawer"].querySelector(".brief-raw")!;
    expect(raw).not.toBeNull();
    expect(raw.textContent).toContain("Fix the vuln");
  });

  it("shows target info grid", () => {
    surface.open(sample(), callbacks);
    const info = surface["drawer"].querySelector(".brief-info")!;
    expect(info.textContent).toContain("github");
    expect(info.textContent).toContain("acme/app");
  });

  it("shows constraints and verification lists when present", () => {
    surface.open(sample(), callbacks);
    expect(surface["drawer"].textContent).toContain("Don't force-push");
    expect(surface["drawer"].textContent).toContain("Tests pass");
  });

  it("shows status message", () => {
    surface.showStatus("Copied!");
    expect(surface["status"].textContent).toBe("Copied!");
  });

  it("calls onCopy when copy button is clicked", () => {
    surface.open(sample(), callbacks);
    (surface["drawer"].querySelector("[data-copy]") as HTMLElement).click();
    expect(callbacks.onCopy).toHaveBeenCalled();
  });
});
