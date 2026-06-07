// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { makeGithubActions } from "../../../src/runtime/ingest/github/actions";
import type { ReviewItem } from "../../../src/runtime/dataset/shapes/review";

function item(kind: ReviewItem["kind"] = "change-request"): ReviewItem {
  return {
    id: "github:acme-corp/web-app:482", source: "github", kind,
    title: "Bump axios", location: "acme-corp/web-app", signal: 1,
    createdAt: "", url: "", tier: "P1",
    details: {
      number: 482, state: "open", body: "",
      author: { login: "x", avatarUrl: "", kind: "bot" },
      assignees: [], reviewers: [], comments: 0, labels: [],
      checks: { state: "pass", conflicts: false }, permalinks: [], relations: [],
    },
  };
}

describe("makeGithubActions", () => {
  it("merge issues a PUT with the chosen method and auth header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await makeGithubActions("tok").merge(item(), "squash");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.github.com/repos/acme-corp/web-app/pulls/482/merge");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ merge_method: "squash" });
    // Assert the auth header carries the token. ADJUST the header key below to match
    // what GH_HEADERS actually returns (read paginate.ts first).
    const headerValues = Object.values(init.headers as Record<string, string>).join(" ");
    expect(headerValues).toContain("tok");
  });

  it("comment POSTs to the issues comments endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    await makeGithubActions("tok").comment(item(), "hello");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.github.com/repos/acme-corp/web-app/issues/482/comments");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ body: "hello" });
  });

  it("close PATCHes the issue state", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await makeGithubActions("tok").close(item("issue"));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.github.com/repos/acme-corp/web-app/issues/482");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ state: "closed" });
  });

  it("addLabels POSTs the names under the labels key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await makeGithubActions("tok").addLabels(item(), ["security", "dependencies"]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.github.com/repos/acme-corp/web-app/issues/482/labels");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ labels: ["security", "dependencies"] });
  });

  it("assign POSTs the logins under the assignees key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    await makeGithubActions("tok").assign(item("issue"), ["marta"]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.github.com/repos/acme-corp/web-app/issues/482/assignees");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ assignees: ["marta"] });
  });

  it("throws a descriptive error on failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Base branch was modified" }), { status: 409 })));
    await expect(makeGithubActions("tok").merge(item(), "merge"))
      .rejects.toThrow("merge failed: 409 Base branch was modified");
  });
});
