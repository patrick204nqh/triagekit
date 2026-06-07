// @vitest-environment jsdom
// test/layout/review-card-body.test.ts
import { describe, it, expect } from "vitest";
import { reviewCardHtml } from "../../src/runtime/layout/review-card";
import type { ReviewItem } from "../../src/runtime/dataset/kinds/review";

const item: ReviewItem = {
  id: "github:acme/api:7", source: "github", kind: "change-request",
  title: "Fix token refresh", location: "acme/api", signal: 0,
  createdAt: "2026-06-01T00:00:00Z", url: "https://github.com/acme/api/pull/7", tier: "P1",
  details: {
    number: 7, state: "open",
    body: "Fixes the **race**.\n\n- adds a mutex\n- `refresh_test`",
    author: { login: "dkohl", avatarUrl: "https://avatars.githubusercontent.com/u/1", kind: "human" },
    assignees: [], reviewers: [], comments: 4, labels: [{ name: "bug", color: "d73a4a" }],
    checks: { state: "pass", conflicts: false },
    permalinks: [{ provider: "github", href: "https://github.com/acme/api/pull/7", kind: "pr", label: "#7" }],
    relations: [],
  },
};

describe("review card body", () => {
  it("renders the body as Markdown, not a truncated snippet", () => {
    const html = reviewCardHtml(item);
    expect(html).toContain("<strong>race</strong>");
    expect(html).toContain("<li");
    expect(html).toContain("<code");
  });
  it("renders a state badge and the author avatar image", () => {
    const html = reviewCardHtml(item);
    expect(html).toContain("rc-state");        // state badge present
    expect(html).toContain("<img");            // author avatar
  });
});
