import { describe, it, expect } from "vitest";
import { actionsFor, isBot, mergeable, reasonNotMergeable } from "../../src/runtime/dataset/kinds/review";
import type { ReviewDetails } from "../../src/runtime/dataset/kinds/review";

const base: ReviewDetails = {
  number: 1, state: "open", body: "x",
  author: { login: "dependabot[bot]", avatarUrl: "", kind: "bot" },
  assignees: [], reviewers: [], comments: 0, labels: [],
  checks: { state: "pass", conflicts: false }, permalinks: [], relations: [],
};

describe("actionsFor", () => {
  it("gives PRs a merge action and issues an assign/close action", () => {
    expect(actionsFor("pull-request")).toEqual(["merge", "comment", "label", "open"]);
    expect(actionsFor("issue")).toEqual(["comment", "assign", "close", "label", "open"]);
  });
});

describe("isBot", () => {
  it("reads the actor kind", () => {
    expect(isBot(base.author)).toBe(true);
    expect(isBot({ login: "marta", avatarUrl: "", kind: "human" })).toBe(false);
  });
});

describe("mergeable / reasonNotMergeable", () => {
  it("is mergeable when checks pass and no conflicts", () => {
    expect(mergeable(base)).toBe(true);
    expect(reasonNotMergeable(base)).toBe("");
  });
  it("blocks on failing checks, conflicts, draft, and closed/merged", () => {
    expect(mergeable({ ...base, checks: { state: "fail", conflicts: false } })).toBe(false);
    expect(reasonNotMergeable({ ...base, checks: { state: "fail", conflicts: false } })).toBe("checks failing");
    expect(reasonNotMergeable({ ...base, checks: { state: "pass", conflicts: true } })).toBe("has merge conflicts");
    expect(reasonNotMergeable({ ...base, state: "draft" })).toBe("still a draft");
    expect(reasonNotMergeable({ ...base, state: "merged" })).toBe("already merged");
  });
});
