import { describe, expect, it } from "vitest";
import { createGithubHttp } from "../../src/runtime/providers/github/http";
import {
  discoverGithubRepositories,
  refreshGithubKinds,
  type GithubKindIngest,
} from "../../src/runtime/providers/github/repository-ingest";

describe("GitHub Provider transport", () => {
  it("discovers repositories through the injected HTTP client", async () => {
    const calls: string[] = [];
    const fetchMock: typeof fetch = async (input) => {
      calls.push(String(input));
      return new Response(JSON.stringify([
        {
          full_name: "acme-corp/web",
          name: "web",
          owner: { login: "acme-corp" },
        },
      ]), { status: 200 });
    };

    const http = createGithubHttp(fetchMock);
    expect(await discoverGithubRepositories(http, "token")).toEqual([
      { value: "acme-corp/web", label: "web", group: "acme-corp" },
    ]);
    expect(calls).toHaveLength(1);
  });

  it("returns partial per-Kind outcomes when one repository fails", async () => {
    const http = createGithubHttp(async () =>
      new Response("{}", { status: 200 }));
    const ingest: GithubKindIngest = {
      kinds: ["issue"],
      async fetchRepository(_http, repository) {
        if (repository.endsWith("/broken")) throw new Error("network down");
        return [{
          id: `github:${repository}:1`,
          provider: "github",
          providerRef: { repository, number: 1 },
          kind: "issue",
          title: "Issue",
          location: repository,
          signal: 1,
          createdAt: "2026-01-01T00:00:00Z",
          url: "",
          details: {},
        }];
      },
    };

    const outcomes = await refreshGithubKinds(http, [ingest], {
      credential: "token",
      scope: { repos: ["acme-corp/web", "acme-corp/broken"] },
      kinds: ["issue"],
    });

    expect(outcomes[0]).toMatchObject({
      kind: "issue",
      status: "partial",
      items: [{ location: "acme-corp/web" }],
      failures: [{ provider: "github", target: "acme-corp/broken" }],
    });
  });
});
