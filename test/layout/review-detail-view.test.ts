// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { reviewDetailView } from "../../src/runtime/layout/review-card/review-card";
import type {
  ScoredItem,
  TriageActionPort,
} from "../../src/runtime/layout/table/kind-renderer";
import type {
  ActionAvailability,
  TriageAction,
} from "../../src/runtime/actions/types";

function pr(overrides: Partial<any> = {}): ScoredItem {
  return {
    id: "github:pr:482", provider: "github", providerRef: {}, kind: "change-request",
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

const actions = (
  availability: readonly ActionAvailability[],
  perform: TriageActionPort["perform"] = async () => ({ status: "confirmed" }),
): TriageActionPort => ({
  available: () => availability,
  perform,
});

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
    const v = reviewDetailView(pr(), {
      actions: actions([{ intent: "merge", variants: ["squash", "merge"] }]),
    });
    v.body(body); v.actions!(foot);
    expect(body.innerHTML).toContain("security fix");
    expect(body.querySelector(".rc-substate")).toBeTruthy();
    expect(foot.querySelector('[data-action="merge"]')).toBeTruthy();
    expect(foot.querySelector('[data-action="open"]')).toBeTruthy();
    expect(foot.querySelector('[data-action="close"]')).toBeNull(); // close is issue-only
  });

  it("issue footer offers close + assign, never merge or CI", () => {
    const issue = reviewDetailView(
      { ...pr(), kind: "issue" } as ScoredItem,
      { actions: actions([{ intent: "close" }, { intent: "assign" }]) },
    );
    issue.actions!(foot);
    expect(foot.querySelector('[data-action="close"]')).toBeTruthy();
    expect(foot.querySelector('[data-action="assign"]')).toBeTruthy();
    expect(foot.querySelector('[data-action="merge"]')).toBeNull();
  });

  it("arming an action re-renders the footer with a confirm control", () => {
    const v = reviewDetailView(pr(), {
      actions: actions([{ intent: "merge", variants: ["squash"] }]),
    });
    v.actions!(foot);
    foot.querySelector<HTMLElement>('[data-action="merge"]')!.click();
    expect(foot.querySelector("[data-method]")).toBeTruthy();
    expect(foot.querySelector("[data-confirm]")).toBeTruthy();
    expect(foot.querySelector("[data-cancel]")).toBeTruthy();
  });

  it("labels merge and text action fields for assistive technology", () => {
    const merge = reviewDetailView(pr(), {
      actions: actions([{ intent: "merge", variants: ["squash"] }]),
    });
    merge.actions!(foot);
    foot.querySelector<HTMLElement>('[data-action="merge"]')!.click();
    expect(foot.querySelector<HTMLSelectElement>("[data-method]")?.labels[0]?.textContent)
      .toBe("Merge as");

    const issue = reviewDetailView(
      { ...pr(), kind: "issue" } as ScoredItem,
      { actions: actions([{ intent: "comment" }]) },
    );
    issue.actions!(foot);
    foot.querySelector<HTMLElement>('[data-action="comment"]')!.click();
    expect(foot.querySelector<HTMLTextAreaElement>("[data-input]")?.labels[0]?.textContent)
      .toBe("Comment");
  });

  it("keeps a malicious title raw in the header data (the frame escapes on render)", () => {
    const evil = reviewDetailView({ ...pr(), title: "<script>alert(1)</script>" } as ScoredItem, {});
    expect(evil.header.title).toContain("<script>");
  });

  it("emits semantic comment intent without a GitHub payload", async () => {
    const scoredIssue = {
      ...pr(),
      providerRef: { repository: "acme-corp/web", number: 7 },
      kind: "issue",
      location: "acme-corp/web",
      signal: 10,
      details: { ...pr().details, number: 7, checks: null },
    } as ScoredItem;
    const performed: TriageAction[] = [];
    const actionPort = actions(
      [{ intent: "comment" }],
      async (action) => {
        performed.push(action);
        return { status: "confirmed" };
      },
    );
    const detail = reviewDetailView(scoredIssue, { actions: actionPort });
    detail.actions!(foot);

    foot.querySelector<HTMLElement>('[data-action="comment"]')!.click();
    foot.querySelector<HTMLTextAreaElement>("[data-input]")!.value = "ship it";
    foot.querySelector<HTMLElement>("[data-confirm]")!.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(performed).toEqual([{
      intent: "comment",
      itemId: scoredIssue.id,
      markdown: "ship it",
    }]);
    expect(foot.querySelector('[data-action="assign"]')).toBeNull();
  });

  it("renders only provider-advertised merge variants", () => {
    const detail = reviewDetailView(pr(), {
      actions: actions([{
        intent: "merge",
        variants: ["squash", "rebase"],
      }]),
    });
    detail.actions!(foot);
    foot.querySelector<HTMLElement>('[data-action="merge"]')!.click();

    expect([
      ...foot.querySelectorAll<HTMLOptionElement>("[data-method] option"),
    ].map(({ value }) => value)).toEqual(["squash", "rebase"]);
  });

  it("disables actions and shows the exact provider retry time", () => {
    const retryAt = Date.parse("2026-07-29T12:00:00.000Z");
    const actionPort = {
      ...actions([{ intent: "comment" }]),
      status: () => ({ paused: true, retryAt }),
    };
    const detail = reviewDetailView(
      { ...pr(), kind: "issue" } as ScoredItem,
      { actions: actionPort },
    );
    detail.actions!(foot);

    expect(foot.querySelector<HTMLButtonElement>(
      '[data-action="comment"]',
    )?.disabled).toBe(true);
    expect(foot.querySelector("time")?.dateTime)
      .toBe("2026-07-29T12:00:00.000Z");
  });
});
