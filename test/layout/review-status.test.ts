// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { reviewDetailView } from "../../src/runtime/layout/review-card/review-card";
import type { DetailCtx, ScoredItem } from "../../src/runtime/layout/table/kind-renderer";

const scored = (projectStatus?: string): ScoredItem => ({
  id: "github:a/b:1",
  source: "github",
  kind: "change-request",
  title: "t",
  location: "a/b",
  signal: 0,
  createdAt: "",
  url: "https://x/y",
  score: 10,
  tier: "P1",
  details: {
    number: 1,
    state: "open",
    body: "",
    author: { login: "u", avatarUrl: "", kind: "human" },
    assignees: [],
    reviewers: [],
    comments: 0,
    labels: [],
    checks: null,
    permalinks: [{ provider: "github", href: "https://x/y", kind: "pr", label: "#1" }],
    relations: [],
    ...(projectStatus ? { projectStatus } : {}),
  },
} as unknown as ScoredItem);

const mount = (item: ScoredItem) => {
  const view = reviewDetailView(item, {} as DetailCtx);
  const host = document.createElement("div");
  view.body(host);
  return host;
};

describe("reviewDetailView project status", () => {
  it("renders a status chip when projectStatus is present", () => {
    const host = mount(scored("In review"));
    expect(host.querySelector(".rc-status")?.textContent).toContain("In review");
  });

  it("renders no status chip when absent", () => {
    expect(mount(scored()).querySelector(".rc-status")).toBeNull();
  });
});
