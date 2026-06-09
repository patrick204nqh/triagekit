// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { reviewDetailView } from "../../src/runtime/layout/review-card/review-card";
import type { ScoredItem } from "../../src/runtime/layout/table/kind-renderer";

function pr(overrides: Partial<any> = {}): ScoredItem {
  return {
    id: "github:pr:482", source: "github", kind: "change-request",
    title: "Bump axios from 1.6.2 to 1.7.4", url: "https://github.com/x/y/pull/482",
    createdAt: new Date().toISOString(), score: 60, tier: "P1",
    details: {
      number: 482, state: "open", body: "## why\nsecurity fix",
      author: { login: "dependabot[bot]", avatarUrl: "", kind: "bot" },
      assignees: [], reviewers: [], comments: 2, labels: [],
      checks: { state: "pass", conflicts: false },
      permalinks: [{ provider: "github", kind: "pr", href: "https://github.com/x/y/pull/482" }],
      relations: [],
      ...overrides,
    },
  } as unknown as ScoredItem;
}

describe("reviewDetailView", () => {
  let body: HTMLElement, foot: HTMLElement;
  beforeEach(() => { body = document.createElement("div"); foot = document.createElement("div"); });

  it("header carries identity with provider + linked number, no literal source text", () => {
    const v = reviewDetailView(pr(), {});
    expect(v.header.title).toContain("axios");
    expect(v.header.tier).toBe("P1");
    expect(v.header.provider).toBe("github");
    expect(v.header.ref).toEqual({ text: "#482", href: "https://github.com/x/y/pull/482" });
  });

  it("body shows state/markdown; footer shows merge for an open mergeable PR", () => {
    const v = reviewDetailView(pr(), {});
    v.body(body); v.actions!(foot);
    expect(body.innerHTML).toContain("security fix");
    expect(body.querySelector(".rc-substate")).toBeTruthy();
    expect(foot.querySelector('[data-action="merge"]')).toBeTruthy();
    expect(foot.querySelector('[data-action="open"]')).toBeTruthy();
    expect(foot.querySelector('[data-action="close"]')).toBeNull(); // close is issue-only
  });

  it("issue footer offers close + assign, never merge or CI", () => {
    const issue = reviewDetailView({ ...pr(), kind: "issue" } as ScoredItem, {});
    issue.actions!(foot);
    expect(foot.querySelector('[data-action="close"]')).toBeTruthy();
    expect(foot.querySelector('[data-action="assign"]')).toBeTruthy();
    expect(foot.querySelector('[data-action="merge"]')).toBeNull();
  });

  it("arming an action re-renders the footer with a confirm control", () => {
    const v = reviewDetailView(pr(), {});
    v.actions!(foot);
    foot.querySelector<HTMLElement>('[data-action="merge"]')!.click();
    expect(foot.querySelector("[data-method]")).toBeTruthy();
    expect(foot.querySelector("[data-confirm]")).toBeTruthy();
    expect(foot.querySelector("[data-cancel]")).toBeTruthy();
  });

  it("keeps a malicious title raw in the header data (the frame escapes on render)", () => {
    const evil = reviewDetailView({ ...pr(), title: "<script>alert(1)</script>" } as ScoredItem, {});
    expect(evil.header.title).toContain("<script>");
  });
});
