import { describe, expect, it } from "vitest";
import { createCore } from "../../src/runtime/core/core";
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

const score: ScoreContext = {
  getModel: () => null,
  getFields: () => [],
  getThresholds: () => ({ p0: 80, p1: 50, p2: 20 }),
  override: (candidate) => candidate.signal,
};

describe("createCore", () => {
  it("refreshes the Dataset Session, derives, and renders", async () => {
    let vm: ViewModel | null = null;
    let items: readonly TriageItem[] = [];
    const refreshed = [item("github:1", 10), item("github:2", 90)];

    const core = createCore({
      items: () => items,
      failures: () => [],
      refresh: async () => {
        items = refreshed;
      },
      view: { render: (model) => { vm = model; } },
      activeKinds: () => ["issue"],
      botLogins: () => [],
      scoreContext: () => score,
      filters: () => emptyListState(),
      focusPolicy: () => ({
        provider: "github",
        repositoryOrder: [],
        labels: { include: [], exclude: [], enabled: true },
      }),
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

  it("rerender re-derives from snapshot items without refreshing", () => {
    const items = [item("github:1", 10)];
    let renders = 0;
    let vm: ViewModel | null = null;

    const core = createCore({
      items: () => items,
      failures: () => [],
      refresh: async () => {},
      view: { render: (model) => { renders += 1; vm = model; } },
      activeKinds: () => ["issue"],
      botLogins: () => [],
      scoreContext: () => score,
      filters: () => emptyListState(),
      focusPolicy: () => ({
        provider: "github",
        repositoryOrder: [],
        labels: { include: [], exclude: [], enabled: true },
      }),
      repoView: () => "",
    });

    core.rerender();

    expect(renders).toBe(1);
    expect(vm!.scored.map((row) => row.id)).toEqual(["github:1"]);
  });
});
