import { describe, it, expect } from "vitest";
import { reviewCardHtml } from "../../src/runtime/layout/review-card";
import type { ReviewItem } from "../../src/runtime/dataset/kinds/review";

function pr(over: Partial<ReviewItem["details"]> = {}): ReviewItem {
  return {
    id: "github:acme-corp/web-app:482", source: "github", kind: "pull-request",
    title: "Bump axios from 1.6.2 to 1.7.4", location: "acme-corp/web-app",
    signal: 70, createdAt: "2026-06-01T00:00:00Z",
    url: "https://github.com/acme-corp/web-app/pull/482", tier: "P1",
    details: {
      number: 482, state: "open", body: "Patches a high-severity SSRF in axios <1.7.4.",
      author: { login: "dependabot[bot]", avatarUrl: "", kind: "bot" },
      assignees: [], reviewers: [{ login: "marta", avatarUrl: "", kind: "human" }],
      comments: 2, labels: [{ name: "security", color: "d6504a" }],
      checks: { state: "pass", conflicts: false },
      permalinks: [{ provider: "github", href: "https://github.com/acme-corp/web-app/pull/482", kind: "pr", label: "#482" }],
      relations: [{ fromId: "x", toId: "github:acme-corp/web-app:482", type: "fixes" }],
      ...over,
    },
  };
}

describe("reviewCardHtml", () => {
  it("renders title, number, tier, and the PR action set", () => {
    const html = reviewCardHtml(pr());
    expect(html).toContain("Bump axios from 1.6.2 to 1.7.4");
    expect(html).toContain("#482");
    expect(html).toContain("tier-P1");
    expect(html).toContain('data-action="merge"');
    expect(html).toContain('data-action="open"');
    expect(html).not.toContain('data-action="close"');   // close is issue-only
  });

  it("enables merge when mergeable, disables with a reason otherwise", () => {
    expect(reviewCardHtml(pr())).not.toMatch(/data-action="merge"[^>]*disabled/);
    const blocked = reviewCardHtml(pr({ checks: { state: "fail", conflicts: false } }));
    expect(blocked).toMatch(/data-action="merge"[^>]*disabled/);
    expect(blocked).toContain("checks failing");
  });

  it("shows the issue action set without CI for issues", () => {
    const issue = pr({ checks: null });
    const html = reviewCardHtml({ ...issue, kind: "issue" });
    expect(html).toContain('data-action="close"');
    expect(html).toContain('data-action="assign"');
    expect(html).not.toContain('data-action="merge"');
    expect(html).not.toContain("ci-pass");
  });

  it("collapsed mode renders only the header with an expand control", () => {
    const html = reviewCardHtml(pr(), { collapsed: true });
    expect(html).toContain("rc-collapsed");
    expect(html).toContain('data-action="expand"');
    expect(html).not.toContain("rc-actions");
  });

  it("renders the armed merge panel with a method selector", () => {
    const html = reviewCardHtml(pr(), {}, { armed: "merge" });
    expect(html).toContain("data-method");
    expect(html).toContain("data-confirm");
    expect(html).toContain("data-cancel");
  });

  it("renders busy and error states", () => {
    expect(reviewCardHtml(pr(), {}, { busy: true })).toContain("spin");
    expect(reviewCardHtml(pr(), {}, { error: "Merge failed: boom" }))
      .toContain("Merge failed: boom");
  });

  it("escapes the title", () => {
    const xss = reviewCardHtml({ ...pr(), title: "<script>alert(1)</script>" });
    expect(xss).toContain("&lt;script&gt;");
  });
});

describe("checks affordance for unfetched PRs", () => {
  it("shows 'open to load' for a PR with null checks", () => {
    const html = reviewCardHtml(pr({ checks: null }));
    expect(html).toContain("checks: open to load");
  });
  it("shows no check indicator for an issue with null checks", () => {
    const issue = { ...pr({ checks: null }), kind: "issue" as const };
    const html = reviewCardHtml(issue);
    expect(html).not.toContain("checks: open to load");
    expect(html).not.toContain("ci-pass");
  });
});
