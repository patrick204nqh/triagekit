// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { HandoffController } from "../../src/runtime/handoff/controller";
import type { ScoredItem } from "../../src/runtime/layout/table/kind-renderer";
import type { SessionState } from "../../src/runtime/session/types";
import { runtimeCatalog } from "../../src/runtime/catalog/built-in";

describe("HandoffController", () => {
  let container: HTMLElement;
  let ctrl: HandoffController;
  let returnFocus: HTMLElement;

  const item: ScoredItem = {
    id: "gh:42", provider: "github", providerRef: {}, kind: "dependency-vuln",
    title: "lodash", location: "acme/app", signal: 80,
    createdAt: "2026-07-26T00:00:00.000Z",
    url: "https://github.com/acme/app/security/42",
    score: 85, tier: "P0",
    details: { alertNumber: 42 },
  };

  const session: SessionState = {
    kind: "dependency-vuln", provider: "github",
    preferredRepository: "acme/app", effectiveRepository: "acme/app",
    view: "table", filters: { query: "", axes: {} },
  };

  beforeEach(() => {
    container = document.createElement("div");
    returnFocus = document.createElement("button");
    document.body.appendChild(container);
    document.body.appendChild(returnFocus);
    ctrl = new HandoffController({
      session: () => session,
      scoreExplain: () => null,
      catalog: runtimeCatalog,
      container,
      returnFocus,
    });
  });

  afterEach(() => {
    document.body.removeChild(container);
    document.body.removeChild(returnFocus);
  });

  it("opens brief surface for a scored item", () => {
    ctrl.openFor(item);
    expect(container.querySelector(".brief-drawer")).not.toBeNull();
    expect(container.querySelector(".brief-drawer")!.textContent).toContain("Agent Brief");
  });

  it("shows outcome in the brief", () => {
    ctrl.openFor(item);
    expect(container.querySelector(".brief-drawer")!.textContent)
      .toContain("Review and remediate the vulnerable dependency");
  });

  it("closes brief surface on close callback", () => {
    ctrl.openFor(item);
    (container.querySelector(".drawer-close") as HTMLElement)?.click();
    expect(container.querySelector(".brief-drawer")!.hidden).toBe(true);
  });

  it("returns focus to the returnFocus element after close", () => {
    ctrl.openFor(item);
    (container.querySelector(".drawer-close") as HTMLElement)?.click();
    expect(document.activeElement).toBe(returnFocus);
  });
});
