// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { HandoffController } from "../../src/runtime/handoff/controller";
import type { ScoredItem } from "../../src/runtime/layout/table/kind-renderer";
import type { SessionState } from "../../src/runtime/session/types";
import { runtimeCatalog } from "../../src/runtime/catalog/built-in";

describe("HandoffController", () => {
  let container: HTMLElement;
  let ctrl: HandoffController;

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
    document.body.appendChild(container);
    ctrl = new HandoffController({
      session: () => session,
      scoreExplain: () => null,
      catalog: runtimeCatalog,
      container,
    });
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("opens brief surface for a scored item", () => {
    ctrl.openFor(item);
    expect(container.querySelector(".brief-drawer")).not.toBeNull();
    expect(container.querySelector(".brief-drawer")!.textContent).toContain("Agent Brief");
  });

  it("closes brief surface on close callback", () => {
    ctrl.openFor(item);
    (container.querySelector(".drawer-close") as HTMLElement)?.click();
    expect(container.querySelector(".brief-drawer")!.hidden).toBe(true);
  });
});
