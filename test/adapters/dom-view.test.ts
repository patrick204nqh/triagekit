// test/adapters/dom-view.test.ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { createDomView } from "../../src/runtime/adapters/dom-view";
import type { ViewModel } from "../../src/runtime/core/view-model";
import type { ScoredItem } from "../../src/runtime/layout/triage-table";

// Minimal manifest registration so the issue renderer exists.
import { registerKinds } from "../../src/runtime/core/register-kinds";

const row = (id: string, score: number): ScoredItem => ({
  id, source: "github", kind: "issue", title: id, location: "r",
  signal: score, createdAt: "2026-01-01T00:00:00Z", url: "", details: {}, score, tier: "P2",
});

describe("DOM view adapter", () => {
  beforeEach(() => {
    registerKinds([{ kind: "issue", domain: "work-items", fields: [{ name: "signal", type: "number" }], builtInScorer: (i) => i.signal, renderer: { kind: "issue" } }]);
    document.body.innerHTML = `<div id="root"></div>`;
  });

  it("renders shown rows from a ViewModel into the host", () => {
    const host = document.getElementById("root")!;
    const view = createDomView(host, {
      artifact: { id: "issues", label: "Issues", group: "work", kinds: ["issue"] } as any,
      onFacetChange: () => {},
      token: "t",
      scoreExplain: () => null,
    });
    const vm: ViewModel = { scored: [row("a", 9)], shown: [row("a", 9)], errors: [], stats: { byProvider: { github: 1 }, byKind: { issue: 1 } } };
    view.render(vm);
    expect(host.querySelector(".surface-body")).not.toBeNull();
    expect(host.querySelector(".facet-host")).toBeNull();   // facet bar retired; toolbar owns facets now
    expect(host.textContent).toContain("a");
  });
});
