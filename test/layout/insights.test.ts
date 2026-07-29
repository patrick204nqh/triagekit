// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderInsights } from "../../src/runtime/layout/insights";
import { snapshotFixture } from "../support/insights";

describe("renderInsights", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement("main");
  });

  it("renders the briefing hierarchy and explicit priority values", () => {
    renderInsights(root, snapshotFixture({
      concentrations: [{
        location: "acme-corp/web",
        total: 6,
        tiers: { P0: 5, P1: 1, P2: 0, P3: 0 },
        weightedPriority: 5_100,
        kinds: ["dependency-vuln"],
      }],
    }), { onRoute: vi.fn(), state: "ready" });

    expect(root.querySelector("h1")?.textContent).toBe("Operator briefing");
    expect(root.querySelector("h2")?.textContent).toBe("Attention now");
    expect(root.querySelector("[data-section='concentration']")?.textContent)
      .toContain("5 P0");
    expect(root.querySelector("[data-section='effectiveness']")).not.toBeNull();
    expect(root.querySelectorAll(".chart")).toHaveLength(0);
  });

  it("emits a typed List route from a concentration row", () => {
    const onRoute = vi.fn();
    renderInsights(root, snapshotFixture({
      concentrations: [{
        location: "acme-corp/web",
        total: 6,
        tiers: { P0: 5, P1: 1, P2: 0, P3: 0 },
        weightedPriority: 5_100,
        kinds: ["dependency-vuln"],
      }],
    }), { onRoute, state: "ready" });

    root.querySelector<HTMLElement>(
      "[data-concentration='acme-corp/web']",
    )!.click();

    expect(onRoute).toHaveBeenCalledWith({
      destination: "list",
      kind: "dependency-vuln",
      repository: "acme-corp/web",
      filters: { tier: ["P0", "P1"] },
    });
  });

  it("renders unavailable coverage as unavailable, not zero percent", () => {
    renderInsights(root, snapshotFixture({
      ownership: { status: "unavailable" },
    }), { onRoute: vi.fn(), state: "ready" });

    expect(root.textContent).toContain("Ownership coverage unavailable");
    expect(root.textContent).not.toContain("Ownership coverage 0%");
  });

  it("renders partial coverage without hiding successful data", () => {
    const snapshot = snapshotFixture({
      coverage: {
        readyKinds: [
          "dependency-vuln",
          "code-scanning",
          "change-request",
          "issue",
        ],
        refreshedKinds: ["dependency-vuln", "change-request", "issue"],
        staleKinds: [],
      },
    });
    renderInsights(root, snapshot, {
      onRoute: vi.fn(),
      state: "partial",
      failures: [{
        provider: "github",
        kind: "code-scanning",
        category: "rate-limit",
        message: "rate limited",
      }],
    });

    expect(root.textContent).toContain("3 of 4 surfaces refreshed");
    expect(root.textContent).toContain("Operator briefing");
    expect(root.textContent).toContain("rate limited");
  });

  it.each([
    ["no-provider", "Connect a provider"],
    ["no-scope", "Choose repositories"],
    ["no-items", "No open items"],
    ["unavailable", "Insights unavailable"],
  ] as const)("renders the %s empty state", (emptyReason, expected) => {
    renderInsights(root, null, {
      onRoute: vi.fn(),
      state: "empty",
      emptyReason,
    });

    expect(root.textContent).toContain(expected);
  });

  it("renders a labelled loading state with a live status", () => {
    renderInsights(root, null, {
      onRoute: vi.fn(),
      state: "loading",
    });

    expect(root.querySelector("[aria-busy='true']")).not.toBeNull();
    expect(root.querySelector("[role='status']")?.textContent).toContain(
      "Refreshing all surfaces",
    );
  });

  it("routes an effectiveness prompt to scoring settings", () => {
    const onRoute = vi.fn();
    renderInsights(root, snapshotFixture({
      diagnostics: [{
        id: "score-separation",
        severity: "attention",
        title: "Score separation",
        explanation: "2 distinct scores rank 12 items.",
        numerator: 2,
        denominator: 12,
        actionId: "scoring",
      }],
    }), { onRoute, state: "ready" });

    root.querySelector<HTMLElement>("[data-diagnostic-action='scoring']")!.click();

    expect(onRoute).toHaveBeenCalledWith({ destination: "scoring" });
  });
});
