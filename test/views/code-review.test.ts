// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderTriageList } from "../../src/runtime/layout/table/detail-panel";
import type { ScoredItem } from "../../src/runtime/layout/table/kind-renderer";
import { registerKinds } from "../../src/runtime/core/register-kinds";
import { changeRequestKind } from "../../src/runtime/kinds/change-request";
import { issueKind } from "../../src/runtime/kinds/issue";
registerKinds([changeRequestKind, issueKind]);   // registers change-request + issue kind renderers + axes
import { getFilterAxis } from "../../src/runtime/layout/toolbar/axis-registry";

it("registers the assignee axis and exactly one (generic) labels axis — no duplicate", () => {
  expect(getFilterAxis("assignee")).toBeDefined();
  expect(getFilterAxis("labels")).toBeDefined();    // generic axis already covers review labels
  expect(getFilterAxis("label")).toBeUndefined();   // the redundant review-specific "Label" axis is gone
});

function pr(over: Partial<ScoredItem> = {}): ScoredItem {
  return {
    id: "github:acme/web:1", source: "github", kind: "change-request", title: "Fix it",
    location: "acme/web", signal: 50, createdAt: "2026-01-01T00:00:00Z", url: "https://x",
    details: { number: 42, state: "open", body: "b", author: { login: "alice", avatarUrl: "", kind: "human" },
      assignees: [], reviewers: [], comments: 0, labels: [], checks: null, permalinks: [], relations: [] },
    score: 90, tier: "P1", ...over,
  } as ScoredItem;
}

describe("review kind renderer", () => {
  it("renders review rows in the shared list with a # column", () => {
    const root = document.createElement("div");
    renderTriageList(root, [pr(), pr({ id: "github:acme/web:2" })], [], { token: "t" });
    expect(root.querySelectorAll(".alert-row").length).toBe(2);
    expect(root.querySelector("thead")!.textContent).toContain("#");
  });

  it("mounts the interactive review card in the drawer on row click", () => {
    const root = document.createElement("div");
    renderTriageList(root, [pr()], [], { token: "t" });
    (root.querySelector(".alert-row") as HTMLElement).click();
    const drawer = root.querySelector<HTMLElement>(".drawer")!;
    expect(drawer.hidden).toBe(false);
    expect(drawer.querySelector(".review-card")).toBeTruthy();
  });
});
