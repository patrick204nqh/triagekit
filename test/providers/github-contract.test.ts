import { describe, expect, it } from "vitest";
import { createGithubHttp } from "../../src/runtime/providers/github/http";
import {
  discoverGithubRepositories,
  refreshGithubKinds,
  type GithubKindIngest,
} from "../../src/runtime/providers/github/repository-ingest";
import { createGithubProvider } from "../../src/runtime/providers/github/provider";

describe("GitHub Provider transport", () => {
  it("exposes one stable Provider declaration", () => {
    const github = createGithubProvider(async () =>
      new Response("[]", { status: 200 }));

    expect(github.id).toBe("github");
    expect(github.kinds).toEqual([
      "dependency-vuln",
      "code-scanning",
      "change-request",
      "issue",
    ]);
    expect(github.capabilities.discoverScope).toBe(true);
    expect(github.capabilities.enrich).toContain("change-request");
    expect(github.capabilities.actions.issue)
      .toEqual(["comment", "assign", "close", "label"]);
  });

  it("normalizes refresh rows behind Provider References", async () => {
    const fetchMock: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("/dependabot/alerts")) {
        return new Response(JSON.stringify([{
          number: 7,
          security_advisory: {
            severity: "high",
            cvss: { score: 7.5 },
          },
          security_vulnerability: {
            first_patched_version: { identifier: "1.2.3" },
          },
          dependency: {
            scope: "runtime",
            package: { name: "axios" },
          },
          created_at: "2026-01-01T00:00:00Z",
          html_url: "https://example.invalid/7",
        }]), { status: 200 });
      }
      return new Response("[]", { status: 200 });
    };
    const github = createGithubProvider(fetchMock);

    const outcomes = await github.adapter!.refresh({
      credential: "token",
      scope: { repos: ["acme-corp/web"] },
      kinds: ["dependency-vuln"],
    });

    expect(outcomes[0].items[0]).toMatchObject({
      provider: "github",
      providerRef: { repository: "acme-corp/web", number: 7 },
      kind: "dependency-vuln",
      title: "axios",
    });
    expect(outcomes[0].items[0].providerRef).not.toHaveProperty(
      "security_advisory",
    );
  });

  it("rejects undeclared actions before making an HTTP request", async () => {
    let calls = 0;
    const github = createGithubProvider(async () => {
      calls++;
      return new Response("{}", { status: 200 });
    });

    await expect(github.adapter!.execute!({
      kind: "issue",
      ref: { repository: "acme-corp/web", number: 1 },
      action: "merge",
    }, "token")).rejects.toThrow(/not declared/i);
    expect(calls).toBe(0);
  });

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
