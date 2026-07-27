import { describe, expect, it } from "vitest";
import type { ProviderDeclaration } from "../../src/runtime/catalog/types";
import { createCore } from "../../src/runtime/core/core";
import { createStore } from "../../src/runtime/core/store";
import type { ViewModel } from "../../src/runtime/core/view-model";
import type { TriageItem } from "../../src/runtime/dataset/item";
import { emptyListState } from "../../src/runtime/layout/toolbar/filter-state";
import type { ScoreContext } from "../../src/runtime/scoring/configured";

const item = (id: string, signal: number): TriageItem => ({
  id,
  provider: "github",
  providerRef: {},
  kind: "issue",
  title: id,
  location: "r",
  signal,
  createdAt: "2026-01-01T00:00:00Z",
  url: "",
  details: {},
});

const provider = (items: readonly TriageItem[]): ProviderDeclaration => ({
  id: "github",
  label: "GitHub",
  status: "ready",
  kinds: ["issue"],
  connection: { setupHint: "Token", scopeFields: [] },
  capabilities: { discoverScope: false, enrich: [], actions: {} },
  adapter: {
    refresh: async () => [{
      kind: "issue",
      status: "success",
      items,
      failures: [],
    }],
  },
});

const score: ScoreContext = {
  getModel: () => null,
  getFields: () => [],
  getThresholds: () => ({ p0: 80, p1: 50, p2: 20 }),
  override: (candidate) => candidate.signal,
};

describe("createCore", () => {
  it("refreshes through a provider adapter, derives, and renders", async () => {
    const store = createStore();
    let vm: ViewModel | null = null;
    const github = provider([item("github:1", 10), item("github:2", 90)]);

    const core = createCore({
      store,
      view: { render: (model) => { vm = model; } },
      jobsFor: () => [{
        provider: github,
        scopeKey: "r1",
        scope: {},
        credential: "t",
        kinds: ["issue"],
      }],
      activeKinds: () => ["issue"],
      botLogins: () => [],
      scoreContext: () => score,
      filters: () => emptyListState(),
      repoView: () => "",
    });

    await core.refreshNow();

    expect(vm!.scored.map((row) => row.id)).toEqual([
      "github:2",
      "github:1",
    ]);
    expect(vm!.stats.byProvider).toEqual({ github: 2 });
    expect(vm!.errors).toEqual([]);
  });

  it("rerender re-derives from the store without refreshing", () => {
    const store = createStore();
    store.upsert([item("github:1", 10)], {
      provider: "github",
      scopeKey: "r1",
      kind: "issue",
      fetchedAt: 1,
    });
    let renders = 0;
    let vm: ViewModel | null = null;

    const core = createCore({
      store,
      view: { render: (model) => { renders += 1; vm = model; } },
      jobsFor: () => [],
      activeKinds: () => ["issue"],
      botLogins: () => [],
      scoreContext: () => score,
      filters: () => emptyListState(),
      repoView: () => "",
    });

    core.rerender();

    expect(renders).toBe(1);
    expect(vm!.scored.map((row) => row.id)).toEqual(["github:1"]);
  });
});
