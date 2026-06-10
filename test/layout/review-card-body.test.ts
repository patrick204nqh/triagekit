// @vitest-environment jsdom
// test/layout/review-card-body.test.ts
import { describe, it, expect } from "vitest";
import { reviewDetailView } from "../../src/runtime/layout/review-card/review-card";
import type { ScoredItem } from "../../src/runtime/layout/table/kind-renderer";

const item = {
  id: "github:acme/api:7", source: "github", kind: "change-request",
  title: "Fix token refresh", location: "acme/api", signal: 0,
  createdAt: "2026-06-01T00:00:00Z", url: "https://github.com/acme/api/pull/7", score: 90, tier: "P1",
  details: {
    number: 7, state: "open",
    body: "Fixes the **race**.\n\n- adds a mutex\n- `refresh_test`",
    author: { login: "dkohl", avatarUrl: "https://avatars.githubusercontent.com/u/1", kind: "human" },
    assignees: [], reviewers: [], comments: 4, labels: [{ name: "bug", color: "d73a4a" }],
    checks: { state: "pass", conflicts: false },
    permalinks: [{ provider: "github", href: "https://github.com/acme/api/pull/7", kind: "pr", label: "#7" }],
    relations: [],
  },
} as unknown as ScoredItem;

describe("review card body (via reviewDetailView)", () => {
  it("renders the body as Markdown, not a truncated snippet", () => {
    const host = document.createElement("div");
    reviewDetailView(item, {}).body(host);
    expect(host.innerHTML).toContain("<strong>race</strong>");
    expect(host.innerHTML).toContain("<li");
    expect(host.innerHTML).toContain("<code");
  });
  it("renders a state badge and the author avatar image", () => {
    const host = document.createElement("div");
    reviewDetailView(item, {}).body(host);
    expect(host.innerHTML).toContain("rc-state");        // state badge present (in substate)
    expect(host.innerHTML).toContain("<img");            // author avatar
  });
});
