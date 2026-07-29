import { describe, expect, it } from "vitest";
import { createGithubProvider } from "../../src/runtime/providers/github/provider";

const collect = async <T>(iterable: AsyncIterable<T>): Promise<T[]> => {
  const values: T[] = [];
  for await (const value of iterable) values.push(value);
  return values;
};

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

    const bound = await github.bind("token");
    const outcomes = await collect(bound.fetchSlices({
      scope: { repos: ["acme-corp/web"] },
      slices: [{ target: "acme-corp/web", kind: "dependency-vuln" }],
      signal: new AbortController().signal,
    }));

    expect(outcomes[0]).toMatchObject({
      type: "changed",
      target: "acme-corp/web",
      kind: "dependency-vuln",
    });
    expect(outcomes[0].type === "changed" && outcomes[0].items[0]).toMatchObject({
      provider: "github",
      providerRef: { repository: "acme-corp/web", number: 7 },
      kind: "dependency-vuln",
      title: "axios",
    });
    expect(outcomes[0].type === "changed" && outcomes[0].items[0].providerRef).not.toHaveProperty(
      "security_advisory",
    );
  });

  it("exposes semantic definitions without a raw provider executor", async () => {
    const bound = await createGithubProvider(async () =>
      new Response("{}", { status: 200 })).bind("token");

    expect("execute" in bound).toBe(false);
    expect(bound.actions?.map(({ intent }) => intent)).toEqual([
      "merge",
      "comment",
      "label",
      "assign",
      "close",
    ]);
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

    const bound = await createGithubProvider(fetchMock).bind("token");
    expect(await bound.discoverScope()).toEqual([
      { value: "acme-corp/web", label: "web", group: "acme-corp" },
    ]);
    expect(calls).toHaveLength(1);
  });

  it("returns partial per-Kind outcomes when one repository fails", async () => {
    const github = createGithubProvider(async (input) => {
      if (String(input).includes("acme-corp/broken")) {
        throw new Error("network down");
      }
      return new Response(JSON.stringify([{
        number: 1,
        title: "Issue",
        user: { login: "alice", type: "User" },
        assignees: [],
        labels: [],
        comments: 0,
        created_at: "2026-01-01T00:00:00Z",
        html_url: "https://example.invalid/1",
      }]), { status: 200 });
    });
    const bound = await github.bind("token");
    const outcomes = await collect(bound.fetchSlices({
      scope: { repos: ["acme-corp/web", "acme-corp/broken"] },
      slices: [
        { target: "acme-corp/web", kind: "issue" },
        { target: "acme-corp/broken", kind: "issue" },
      ],
      signal: new AbortController().signal,
    }));

    expect(outcomes[0]).toMatchObject({
      type: "changed",
      kind: "issue",
      target: "acme-corp/web",
      items: [{ location: "acme-corp/web" }],
    });
    expect(outcomes[1]).toMatchObject({
      type: "failed",
      kind: "issue",
      target: "acme-corp/broken",
      failure: { provider: "github", target: "acme-corp/broken" },
    });
  });

  it("classifies paginated SSO failures as authentication failures", async () => {
    const github = createGithubProvider(async () =>
      new Response(JSON.stringify({ message: "Resource protected by SAML SSO" }), {
        status: 403,
        headers: { "x-github-sso": "required" },
      }));

    const bound = await github.bind("token");
    const outcomes = await collect(bound.fetchSlices({
      scope: { repos: ["acme-corp/web"] },
      slices: [{ target: "acme-corp/web", kind: "dependency-vuln" }],
      signal: new AbortController().signal,
    }));

    expect(outcomes[0]).toMatchObject({
      type: "failed",
      failure: {
        provider: "github",
        kind: "dependency-vuln",
        target: "acme-corp/web",
        category: "auth",
      },
    });
  });
});
