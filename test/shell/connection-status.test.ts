// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DatasetSnapshot } from "../../src/runtime/cached-dataset/types";
import {
  connectionDatasetState,
  mountConnectionStatus,
  type ConnectionStatusModel,
} from "../../src/runtime/shell/connection-status";

function snapshot(
  overrides: Partial<DatasetSnapshot> = {},
): DatasetSnapshot {
  return {
    phase: "ready",
    provider: "github",
    scope: { repos: ["acme-corp/core"] },
    cadence: 300,
    items: [],
    slices: [{
      target: "acme-corp/core",
      kind: "issue",
      freshness: "fresh",
    }],
    persistence: "indexeddb",
    warnings: [],
    ...overrides,
  };
}

const model = (
  overrides: Partial<ConnectionStatusModel> = {},
): ConnectionStatusModel => ({
  provider: "github",
  connected: true,
  scopeSummary: "11 repositories",
  lastFetchedAt: 1_000_000_000_000 - 2 * 60_000,
  cadence: 300,
  datasetState: "current",
  ...overrides,
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("connectionDatasetState", () => {
  it("derives state with closed, memory, and stale precedence", () => {
    expect(connectionDatasetState(undefined)).toBe("not-synced");
    expect(connectionDatasetState(snapshot({ phase: "closed" })))
      .toBe("not-synced");
    expect(connectionDatasetState(snapshot({ persistence: "memory" })))
      .toBe("memory-only");
    expect(connectionDatasetState(snapshot({ phase: "partial" })))
      .toBe("stale");
    expect(connectionDatasetState(snapshot({ phase: "paused" })))
      .toBe("stale");
    expect(connectionDatasetState(snapshot({
      slices: [{
        target: "acme-corp/core",
        kind: "issue",
        freshness: "failed",
      }],
    }))).toBe("stale");
    expect(connectionDatasetState(snapshot())).toBe("current");
  });
});

describe("mountConnectionStatus", () => {
  it("renders provider, scope, and freshness in one collapsed disclosure", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000_000_000);
    const host = document.createElement("div");
    document.body.appendChild(host);
    const controller = mountConnectionStatus(host, {
      openSettings: vi.fn(),
    });

    controller.render(model());

    const trigger = host.querySelector<HTMLButtonElement>(
      "[data-connection-status-trigger]",
    )!;
    expect(trigger.textContent).toContain("github");
    expect(trigger.textContent).toContain("11 repositories");
    expect(trigger.textContent).toContain("updated 2m ago");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(host.querySelector(".last-sync")).toBeNull();
  });

  it("opens a fact-rich dropdown and routes both Settings actions", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000_000_000);
    const host = document.createElement("div");
    document.body.appendChild(host);
    const openSettings = vi.fn();
    const controller = mountConnectionStatus(host, { openSettings });
    controller.render(model());
    const trigger = host.querySelector<HTMLButtonElement>(
      "[data-connection-status-trigger]",
    )!;
    const menu = host.querySelector<HTMLElement>(
      "[data-connection-status-menu]",
    )!;

    expect(menu.hidden).toBe(true);
    trigger.click();

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(menu.hidden).toBe(false);
    expect(menu.textContent).toContain("Connected");
    expect(menu.textContent).toContain("11 repositories");
    expect(menu.textContent).toContain("updated 2m ago");
    expect(menu.textContent).toContain("Every 5 minutes");
    expect(menu.textContent).toContain("Current");

    host.querySelector<HTMLButtonElement>("[data-status-connections]")!.click();
    expect(openSettings).toHaveBeenCalledWith("github", "connections");

    trigger.click();
    host.querySelector<HTMLButtonElement>("[data-status-repositories]")!.click();
    expect(openSettings).toHaveBeenCalledWith("github", "repositories");
  });

  it("closes on Escape and outside pointer interaction with focus restoration", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const controller = mountConnectionStatus(host, {
      openSettings: vi.fn(),
    });
    controller.render(model());
    const trigger = host.querySelector<HTMLButtonElement>(
      "[data-connection-status-trigger]",
    )!;
    const menu = host.querySelector<HTMLElement>(
      "[data-connection-status-menu]",
    )!;

    trigger.click();
    host.querySelector<HTMLButtonElement>("[data-status-connections]")!.focus();
    document.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
    }));

    expect(menu.hidden).toBe(true);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);

    trigger.click();
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(menu.hidden).toBe(true);

    controller.close();
    controller.close();
    expect(menu.hidden).toBe(true);
  });

  it("links the trigger to an accessibly named menu", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const controller = mountConnectionStatus(host, {
      openSettings: vi.fn(),
    });
    controller.render(model());
    const trigger = host.querySelector<HTMLButtonElement>(
      "[data-connection-status-trigger]",
    )!;
    const menu = host.querySelector<HTMLElement>(
      "[data-connection-status-menu]",
    )!;

    expect(trigger.getAttribute("aria-controls")).toBe(menu.id);
    expect(menu.getAttribute("aria-labelledby")).not.toBeNull();
    expect(document.getElementById(menu.getAttribute("aria-labelledby")!))
      .not.toBeNull();
    expect(host.querySelector("[data-status-connections]")).not.toBeNull();
    expect(host.querySelector("[data-status-repositories]")).not.toBeNull();
  });
});
