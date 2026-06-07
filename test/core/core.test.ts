// test/core/core.test.ts
import { describe, it, expect } from "vitest";
import { createCore } from "../../src/runtime/core/core";
import { createStore } from "../../src/runtime/core/store";
import { emptyListState } from "../../src/runtime/layout/filter-state";
import type { ViewModel } from "../../src/runtime/core/view-model";
import type { ProviderPort } from "../../src/runtime/core/ports";
import type { TriageItem } from "../../src/runtime/dataset/item";
import type { ScoreContext } from "../../src/runtime/scoring/configured";

const item = (id: string, signal: number): TriageItem => ({
  id, source: "github", kind: "issue", title: id, location: "r",
  signal, createdAt: "2026-01-01T00:00:00Z", url: "", details: {},
});
const score: ScoreContext = { getModel: () => null, getFields: () => [], getThresholds: () => ({ p0: 80, p1: 50, p2: 20 }), override: (i) => i.signal };

describe("createCore", () => {
  it("refreshNow fetches, merges, derives, and renders a ViewModel", async () => {
    const store = createStore();
    let vm: ViewModel | null = null;
    const gh: ProviderPort = { id: "github", kinds: ["issue"], fetch: async () => ({ items: [item("github:1", 10), item("github:2", 90)], errors: [] }) };

    const core = createCore({
      store,
      view: { render: (m) => { vm = m; } },
      jobsFor: () => [{ provider: "github", scopeKey: "r1", scope: {}, token: "t", port: gh }],
      activeKinds: () => ["issue"],
      botLogins: () => [],
      scoreContext: () => score,
      facets: () => emptyListState(),
    });

    await core.refreshNow();
    expect(vm!.scored.map(r => r.id)).toEqual(["github:2", "github:1"]); // sorted desc
    expect(vm!.stats.byProvider).toEqual({ github: 2 });
    expect(vm!.errors).toEqual([]);
  });

  it("rerender re-derives from the store without refetching", async () => {
    const store = createStore();
    store.upsert([item("github:1", 10)], { provider: "github", scopeKey: "r1", fetchedAt: 1 });
    let renders = 0; let vm: ViewModel | null = null;
    let fetched = 0;
    const gh: ProviderPort = { id: "github", kinds: ["issue"], fetch: async () => { fetched++; return { items: [], errors: [] }; } };

    const core = createCore({
      store, view: { render: (m) => { renders++; vm = m; } },
      jobsFor: () => [{ provider: "github", scopeKey: "r1", scope: {}, token: "t", port: gh }],
      activeKinds: () => ["issue"], botLogins: () => [], scoreContext: () => score, facets: () => emptyListState(),
    });

    core.rerender();
    expect(fetched).toBe(0);
    expect(renders).toBe(1);
    expect(vm!.scored.map(r => r.id)).toEqual(["github:1"]);
  });
});
