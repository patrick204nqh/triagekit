// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderReviewQueue } from "../../src/runtime/views/review/view";
import type { ScoredItem } from "../../src/runtime/layout/triage-table";

function reviewRow(over: Partial<ScoredItem> = {}): ScoredItem {
  return {
    id: "github:acme/web:1", source: "github", kind: "pull-request",
    title: "Fix it", location: "acme/web", signal: 50,
    createdAt: "2026-01-01T00:00:00Z", url: "https://x",
    details: {
      number: 1, state: "open", body: "", author: { login: "a", avatarUrl: "", kind: "human" },
      labels: [], assignees: [], reviewers: [], comments: 0, checks: null,
      permalinks: [], relations: [],
    },
    score: 90, tier: "P1", ...over,
  } as ScoredItem;
}

describe("renderReviewQueue (render-only)", () => {
  it("renders one card host per given row", () => {
    const root = document.createElement("div");
    renderReviewQueue(root, [reviewRow({}), reviewRow({ id: "github:acme/web:2" })], [], { token: "t" });
    expect(root.querySelectorAll(".review-list > *").length).toBe(2);
  });

  it("shows the empty state for no rows", () => {
    const root = document.createElement("div");
    renderReviewQueue(root, [], [], { token: "t" });
    expect(root.textContent).toContain("No items");
  });
});
