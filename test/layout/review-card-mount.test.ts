// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { mountReviewCard } from "../../src/runtime/layout/review-card";
import type { ReviewActions, ReviewItem } from "../../src/runtime/dataset/kinds/review";

function pr(over: Partial<ReviewItem["details"]> = {}, kind: ReviewItem["kind"] = "pull-request"): ReviewItem {
  return {
    id: "github:acme-corp/web-app:482", source: "github", kind,
    title: "Bump axios", location: "acme-corp/web-app", signal: 70,
    createdAt: "2026-06-01T00:00:00Z", url: "https://gh/pr/482", tier: "P1",
    details: {
      number: 482, state: "open", body: "patch",
      author: { login: "dependabot[bot]", avatarUrl: "", kind: "bot" },
      assignees: [], reviewers: [], comments: 2, labels: [],
      checks: { state: "pass", conflicts: false },
      permalinks: [{ provider: "github", href: "https://gh/pr/482", kind: "pr" }],
      relations: [], ...over,
    },
  };
}

function spyActions(overrides: Partial<ReviewActions> = {}) {
  const calls: string[] = [];
  const base: ReviewActions = {
    merge: async () => { calls.push("merge"); },
    comment: async () => { calls.push("comment"); },
    addLabels: async () => { calls.push("addLabels"); },
    assign: async () => { calls.push("assign"); },
    close: async () => { calls.push("close"); },
  };
  return { actions: { ...base, ...overrides }, calls };
}

const flush = () => new Promise(r => setTimeout(r, 0));

describe("mountReviewCard", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("merge arms, confirms, calls the action, and transitions to merged", async () => {
    const host = document.createElement("div"); document.body.appendChild(host);
    const { actions, calls } = spyActions();
    let changed: ReviewItem | null = null;
    mountReviewCard(host, pr(), { actions, onChange: (i) => { changed = i; } });

    host.querySelector<HTMLElement>('[data-action="merge"]')!.click();
    expect(host.querySelector("[data-method]")).toBeTruthy();         // armed
    host.querySelector<HTMLElement>("[data-confirm]")!.click();
    await flush();

    expect(calls).toEqual(["merge"]);
    expect(host.querySelector(".review-card")!.getAttribute("data-state")).toBe("merged");
    expect(changed!.details.state).toBe("merged");
  });

  it("does not arm merge when checks fail (button disabled)", () => {
    const host = document.createElement("div"); document.body.appendChild(host);
    const { actions, calls } = spyActions();
    mountReviewCard(host, pr({ checks: { state: "fail", conflicts: false } }), { actions });
    const btn = host.querySelector<HTMLButtonElement>('[data-action="merge"]')!;
    expect(btn.disabled).toBe(true);
    btn.click();
    expect(host.querySelector("[data-method]")).toBeNull();
    expect(calls).toEqual([]);
  });

  it("surfaces an action error inline and keeps actions usable", async () => {
    const host = document.createElement("div"); document.body.appendChild(host);
    const { actions } = spyActions({ merge: async () => { throw new Error("branch out of date"); } });
    mountReviewCard(host, pr(), { actions });
    host.querySelector<HTMLElement>('[data-action="merge"]')!.click();
    host.querySelector<HTMLElement>("[data-confirm]")!.click();
    await flush();
    expect(host.querySelector(".rc-error")!.textContent).toContain("branch out of date");
    expect(host.querySelector('[data-action="merge"]')).toBeTruthy();   // bar restored
  });

  it("comment reads the field, calls comment, and increments the count", async () => {
    const host = document.createElement("div"); document.body.appendChild(host);
    const { actions, calls } = spyActions();
    mountReviewCard(host, pr({ comments: 2 }), { actions });
    host.querySelector<HTMLElement>('[data-action="comment"]')!.click();
    host.querySelector<HTMLTextAreaElement>("[data-input]")!.value = "looks good";
    host.querySelector<HTMLElement>("[data-confirm]")!.click();
    await flush();
    expect(calls).toEqual(["comment"]);
    expect(host.querySelector(".rc-comments")!.textContent).toContain("3");
  });

  it("issue close arms, confirms, and transitions to closed", async () => {
    const host = document.createElement("div"); document.body.appendChild(host);
    const { actions, calls } = spyActions();
    mountReviewCard(host, pr({ checks: null }, "issue"), { actions });
    host.querySelector<HTMLElement>('[data-action="close"]')!.click();
    host.querySelector<HTMLElement>("[data-confirm]")!.click();
    await flush();
    expect(calls).toEqual(["close"]);
    expect(host.querySelector(".review-card")!.getAttribute("data-state")).toBe("closed");
  });

  it("collapsed card expands on click", () => {
    const host = document.createElement("div"); document.body.appendChild(host);
    mountReviewCard(host, pr(), { collapsed: true, actions: spyActions().actions });
    expect(host.querySelector(".rc-collapsed")).toBeTruthy();
    host.querySelector<HTMLElement>('[data-action="expand"]')!.click();
    expect(host.querySelector(".rc-collapsed")).toBeNull();
    expect(host.querySelector(".rc-actions")).toBeTruthy();
  });
});
