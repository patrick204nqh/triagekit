// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { HandoffController } from "../../src/runtime/handoff/controller";
import type { ScoredItem } from "../../src/runtime/layout/table/kind-renderer";
import type { SessionState } from "../../src/runtime/session/types";
import { runtimeCatalog } from "../../src/runtime/catalog/built-in";

describe("HandoffController", () => {
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
    ctrl = new HandoffController({
      session: () => session,
      scoreExplain: () => null,
      catalog: runtimeCatalog,
    });
  });

  it("generates a handoff for a scored item", () => {
    const handoff = ctrl.generateFor(item);
    expect(handoff.schema).toBe("triagekit.agent-handoff");
    expect(handoff.intent.outcome).toContain("vulnerable dependency");
    expect(handoff.targets).toHaveLength(1);
    expect(handoff.targets[0].id).toBe("gh:42");
  });

  it("includes session context in the handoff", () => {
    const handoff = ctrl.generateFor(item);
    expect(handoff.context.session.repository).toBe("acme/app");
  });

  it("generates handoffs with correct intent defaults per kind", () => {
    const prItem: ScoredItem = { ...item, kind: "change-request" as any };
    const h = ctrl.generateFor(prItem);
    expect(h.intent.outcome).toContain("merge the pull request");
  });
});
