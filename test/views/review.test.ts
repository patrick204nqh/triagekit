// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { renderReviewQueue } from "../../src/runtime/views/review/view";
import type { ScoredItem } from "../../src/runtime/layout/triage-table";
import type { ReviewDetails } from "../../src/runtime/dataset/kinds/review";

function row(over: Partial<ScoredItem> & { details?: Partial<ReviewDetails> } = {}): ScoredItem {
  const { details, ...rest } = over;
  return {
    id: "github:acme/web:1", source: "github", kind: "pull-request", title: "t",
    location: "acme/web", signal: 0, createdAt: "2026-01-01T00:00:00Z", url: "",
    score: 100, tier: "P1",
    details: {
      number: 1, state: "open", body: "", author: { login: "marta", avatarUrl: "", kind: "human" },
      assignees: [], reviewers: [], comments: 0, labels: [], checks: null, permalinks: [], relations: [],
      ...details,
    },
    ...rest,
  } as ScoredItem;
}

const ctx = { token: "t" };

describe("renderReviewQueue", () => {
  let root: HTMLElement;
  beforeEach(() => { document.body.innerHTML = ""; root = document.createElement("div"); document.body.appendChild(root); });

  const rows: ScoredItem[] = [
    row({ id: "github:acme/web:1", kind: "pull-request", score: 90, createdAt: "2026-01-01T00:00:00Z",
      details: { number: 1, author: { login: "dependabot[bot]", avatarUrl: "", kind: "bot" } } }),
    row({ id: "github:acme/api:2", kind: "issue", location: "acme/api", score: 50, createdAt: "2026-05-01T00:00:00Z",
      details: { number: 2, author: { login: "marta", avatarUrl: "", kind: "human" } } }),
  ];

  it("mounts one collapsed card per row", () => {
    renderReviewQueue(root, rows, [], ctx);
    expect(root.querySelectorAll(".review-card.rc-collapsed").length).toBe(2);
  });

  it("filters by the Issues facet", () => {
    renderReviewQueue(root, rows, [], ctx);
    root.querySelector<HTMLElement>('[data-facet="issue"]')!.click();
    const cards = root.querySelectorAll(".review-card");
    expect(cards.length).toBe(1);
    expect(cards[0].getAttribute("data-kind")).toBe("issue");
  });

  it("filters by the Bot facet", () => {
    renderReviewQueue(root, rows, [], ctx);
    root.querySelector<HTMLElement>('[data-facet="bot"]')!.click();
    expect(root.querySelectorAll(".review-card").length).toBe(1);
    expect(root.querySelector(".review-card")!.getAttribute("data-kind")).toBe("pull-request");
  });

  it("reorders by Recent vs Priority", () => {
    renderReviewQueue(root, rows, [], ctx);
    const nums = () => [...root.querySelectorAll(".rc-num")].map(n => n.textContent);
    expect(nums()).toEqual(["#1", "#2"]);                 // priority: score 90 before 50
    root.querySelector<HTMLElement>('[data-sort="recent"]')!.click();
    expect(nums()).toEqual(["#2", "#1"]);                 // recent: 2026-05 before 2026-01
  });

  it("shows an empty state when no rows match the facet", () => {
    renderReviewQueue(root, [rows[0]], [], ctx);          // only a PR
    root.querySelector<HTMLElement>('[data-facet="issue"]')!.click();
    expect(root.querySelector(".review-list")!.textContent).toContain("No items match");
  });
});
