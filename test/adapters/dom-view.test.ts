// test/adapters/dom-view.test.ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { createDomView } from "../../src/runtime/adapters/dom-view";
import type { ViewModel } from "../../src/runtime/core/view-model";
import type { ScoredItem } from "../../src/runtime/layout/table/kind-renderer";
import { vi } from "vitest";

// Minimal manifest registration so the issue renderer exists.

const row = (id: string, score: number): ScoredItem => ({
  id, provider: "github", providerRef: {}, kind: "issue", title: id, location: "r",
  signal: score,
  createdAt: "2026-01-01T00:00:00Z",
  url: "",
  details: {
    number: 1,
    state: "open",
    body: "",
    author: { login: "alice", avatarUrl: "", kind: "human" },
    assignees: [],
    reviewers: [],
    comments: 0,
    labels: [],
    checks: null,
    permalinks: [],
    relations: [],
  },
  score,
  tier: "P2",
});

describe("DOM view adapter", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="root"></div>`;
  });

  it("renders shown rows from a ViewModel into the host", () => {
    const host = document.getElementById("root")!;
    const view = createDomView(host, {
      artifact: { id: "issue", label: "Issues", group: "work", kinds: ["issue"] } as any,
      onFilterChange: () => {},
      token: "t",
      scoreExplain: () => null,
    });
    const vm: ViewModel = { scored: [row("a", 9)], shown: [row("a", 9)], errors: [], stats: { byProvider: { github: 1 }, byKind: { issue: 1 } } };
    view.render(vm);
    expect(host.querySelector(".surface-body")).not.toBeNull();
    expect(host.querySelector(".facet-host")).toBeNull();   // retired filter bar's DOM stays absent; toolbar owns filters now
    expect(host.textContent).toContain("a");
  });

  it("passes queue selection intents into the rendered table", () => {
    const host = document.getElementById("root")!;
    const onToggle = vi.fn();
    const view = createDomView(host, {
      artifact: {
        id: "issue",
        label: "Issues",
        group: "work",
        kinds: ["issue"],
      } as any,
      scoreExplain: () => null,
      handoffSelection: {
        queuedKeys: new Set(),
        onToggle,
      },
    });
    const item = row("a", 9);
    view.render({
      scored: [item],
      shown: [item],
      errors: [],
      stats: { byProvider: { github: 1 }, byKind: { issue: 1 } },
    });
    host.querySelector<HTMLElement>("[data-queue-select]")!.click();
    expect(onToggle).toHaveBeenCalledWith(item);
  });

  it("keeps an open item drawer across background rerenders", () => {
    const host = document.getElementById("root")!;
    const item = row("a", 9);
    const view = createDomView(host, {
      artifact: {
        id: "issue",
        label: "Issues",
        group: "work",
        kinds: ["issue"],
      } as any,
      scoreExplain: () => null,
    });
    const vm: ViewModel = {
      scored: [item],
      shown: [item],
      errors: [],
      stats: {
        byProvider: { github: 1 },
        byKind: { issue: 1 },
      },
    };

    view.render(vm);
    host.querySelector<HTMLElement>(".alert-row")!.click();
    expect(host.querySelector<HTMLElement>(".drawer")!.hidden).toBe(false);

    view.render({
      ...vm,
      scored: [{ ...item, score: 10 }],
      shown: [{ ...item, score: 10 }],
    });

    expect(host.querySelector<HTMLElement>(".drawer")!.hidden).toBe(false);
    expect(host.querySelector("[data-head]")?.textContent).toContain("a");
  });
});
