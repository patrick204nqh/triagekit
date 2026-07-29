import { describe, expect, it, vi } from "vitest";
import { createGithubHttp } from "../../src/runtime/providers/github/http";
import { createGithubRequestScheduler } from "../../src/runtime/providers/github/scheduler";
import { createGithubProvider } from "../../src/runtime/providers/github/provider";

const collect = async <T>(iterable: AsyncIterable<T>): Promise<T[]> => {
  const values: T[] = [];
  for await (const value of iterable) values.push(value);
  return values;
};

describe("GitHub HTTP validators", () => {
  it("sends If-None-Match and returns unchanged for 304", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("if-none-match"))
        .toBe("\"slice-v1\"");
      return new Response(null, {
        status: 304,
        headers: { etag: "\"slice-v1\"" },
      });
    });
    const scheduler = createGithubRequestScheduler({ fetch: fetchImpl });
    const http = createGithubHttp("token", scheduler);

    await expect(http.paginate("/issues", {
      priority: "manual-refresh",
      retry: "safe-read",
      validator: "\"slice-v1\"",
    })).resolves.toEqual({
      rows: [],
      validator: "\"slice-v1\"",
      unchanged: true,
    });
  });

  it("uses the first page ETag for the complete paginated resource", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const page = Number(new URL(String(input)).searchParams.get("page") ?? "1");
      return new Response(JSON.stringify([{ page }]), {
        status: 200,
        headers: page === 1
          ? {
            etag: "\"complete-v2\"",
            link: "<https://api.github.com/issues?page=2>; rel=\"next\"",
          }
          : { etag: "\"page-two\"" },
      });
    });
    const scheduler = createGithubRequestScheduler({ fetch: fetchImpl });
    const http = createGithubHttp("token", scheduler);

    await expect(http.paginate("/issues", {
      priority: "startup-refresh",
      retry: "safe-read",
    })).resolves.toEqual({
      rows: [{ page: 1 }, { page: 2 }],
      validator: "\"complete-v2\"",
      unchanged: false,
    });
  });

  it("yields an unchanged Dataset Slice for a validated 304", async () => {
    const provider = createGithubProvider(async (_input, init) => {
      expect(new Headers(init?.headers).get("if-none-match"))
        .toBe("\"slice-v1\"");
      return new Response(null, {
        status: 304,
        headers: { etag: "\"slice-v1\"" },
      });
    });
    const bound = await provider.bind("token");

    const outcomes = await collect(bound.fetchSlices({
      scope: { repos: ["acme-corp/web"] },
      slices: [{
        target: "acme-corp/web",
        kind: "issue",
        validator: "\"slice-v1\"",
      }],
      signal: new AbortController().signal,
    }));

    expect(outcomes).toEqual([{
      type: "unchanged",
      target: "acme-corp/web",
      kind: "issue",
      validator: "\"slice-v1\"",
    }]);
  });
});
