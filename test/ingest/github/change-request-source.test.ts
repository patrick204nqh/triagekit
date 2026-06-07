// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { githubReviewSource, enrichReview, isBotLogin } from "../../../src/runtime/ingest/github/change-request-source";
import type { ReviewDetails } from "../../../src/runtime/dataset/kinds/review";
import type { TriageItem } from "../../../src/runtime/dataset/item";

describe("isBotLogin", () => {
  it("matches [bot] suffix and the known-bot list, case-insensitively", () => {
    expect(isBotLogin("dependabot[bot]")).toBe(true);
    expect(isBotLogin("Renovate")).toBe(true);
    expect(isBotLogin("marta")).toBe(false);
  });
});

describe("githubReviewSource.fetch", () => {
  it("maps a PR (has pull_request) and an issue distinctly from the issues endpoint", async () => {
    const raw = [
      { number: 7, title: "Bump axios", html_url: "https://gh/acme/web/pull/7", created_at: "2026-01-01T00:00:00Z",
        pull_request: { url: "x" }, draft: false, comments: 2,
        user: { login: "dependabot[bot]", type: "Bot", avatar_url: "a" },
        assignees: [], labels: [{ name: "security", color: "d6504a" }] },
      { number: 8, title: "Login is broken", html_url: "https://gh/acme/web/issues/8", created_at: "2026-02-01T00:00:00Z",
        comments: 0, user: { login: "marta", type: "User", avatar_url: "b" },
        assignees: [{ login: "ravi", type: "User", avatar_url: "c" }], labels: [] },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(raw), { status: 200 })));
    const { items, errors } = await githubReviewSource.fetch({ repos: ["acme/web"] }, "t");
    expect(errors).toEqual([]);
    expect(items).toHaveLength(2);

    const prItem = items.find(i => i.kind === "change-request")! as TriageItem<ReviewDetails>;
    expect(prItem.id).toBe("github:acme/web:7");
    expect(prItem.location).toBe("acme/web");
    expect(prItem.details.author.kind).toBe("bot");
    expect(prItem.details.labels).toEqual([{ name: "security", color: "d6504a" }]);
    expect(prItem.details.checks).toBeNull();
    expect(prItem.details.permalinks[0]).toMatchObject({ provider: "github", kind: "pr", label: "#7" });

    const issueItem = items.find(i => i.kind === "issue")! as TriageItem<ReviewDetails>;
    expect(issueItem.id).toBe("github:acme/web:8");
    expect(issueItem.details.author.kind).toBe("human");
    expect(issueItem.details.assignees.map(a => a.login)).toEqual(["ravi"]);
  });

  it("surfaces a failed repo non-fatally with the full name as target", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("/locked/")
      ? new Response(JSON.stringify({ message: "Not Found" }), { status: 404 })
      : new Response(JSON.stringify([]), { status: 200 })));
    const { items, errors } = await githubReviewSource.fetch({ repos: ["acme/ok", "acme/locked"] }, "t");
    expect(items).toEqual([]);
    expect(errors).toEqual([{ target: "acme/locked", message: "404 Not Found" }]);
  });
});

describe("enrichReview", () => {
  it("fetches the PR head sha, check-runs, and mergeable for a pull request", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/pulls/7")) {
        return new Response(JSON.stringify({ head: { sha: "abc" }, mergeable: false,
          requested_reviewers: [{ login: "marta", type: "User", avatar_url: "a" }] }), { status: 200 });
      }
      if (url.includes("/commits/abc/check-runs")) {
        return new Response(JSON.stringify({ check_runs: [{ status: "completed", conclusion: "success" }] }), { status: 200 });
      }
      throw new Error("unexpected " + url);
    });
    vi.stubGlobal("fetch", fetchMock);
    const item = { id: "github:acme/web:7", source: "github", kind: "change-request", title: "", location: "acme/web",
      signal: 0, createdAt: "", url: "", details: { number: 7 } } as unknown as TriageItem<ReviewDetails>;
    const patch = await enrichReview(item, "t");
    expect(patch.checks).toEqual({ state: "pass", conflicts: true });
    expect(patch.reviewers!.map(r => r.login)).toEqual(["marta"]);
  });

  it("rolls up a failing check-run to checks.state 'fail'", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.endsWith("/pulls/7")) return new Response(JSON.stringify({ head: { sha: "abc" }, mergeable: true, requested_reviewers: [] }), { status: 200 });
      if (url.includes("/commits/abc/check-runs")) return new Response(JSON.stringify({ check_runs: [{ status: "completed", conclusion: "failure" }] }), { status: 200 });
      throw new Error("unexpected " + url);
    }));
    const item = { kind: "change-request", location: "acme/web", details: { number: 7 } } as unknown as TriageItem<ReviewDetails>;
    const patch = await enrichReview(item, "t");
    expect(patch.checks).toEqual({ state: "fail", conflicts: false });
  });

  it("rolls up an in-progress check-run to checks.state 'pending'", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.endsWith("/pulls/7")) return new Response(JSON.stringify({ head: { sha: "abc" }, mergeable: true, requested_reviewers: [] }), { status: 200 });
      if (url.includes("/commits/abc/check-runs")) return new Response(JSON.stringify({ check_runs: [{ status: "in_progress", conclusion: null }] }), { status: 200 });
      throw new Error("unexpected " + url);
    }));
    const item = { kind: "change-request", location: "acme/web", details: { number: 7 } } as unknown as TriageItem<ReviewDetails>;
    const patch = await enrichReview(item, "t");
    expect(patch.checks).toEqual({ state: "pending", conflicts: false });
  });

  it("is a no-op for an issue", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const item = { kind: "issue", location: "acme/web", details: { number: 8 } } as unknown as TriageItem<ReviewDetails>;
    expect(await enrichReview(item, "t")).toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns an empty patch when the network throws", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    const item = { kind: "change-request", location: "acme/web", details: { number: 7 } } as unknown as TriageItem<ReviewDetails>;
    expect(await enrichReview(item, "t")).toEqual({});
  });
});
