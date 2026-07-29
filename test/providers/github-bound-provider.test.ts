import { describe, expect, it } from "vitest";
import { createGithubProvider } from "../../src/runtime/providers/github/provider";

const collect = async <T>(iterable: AsyncIterable<T>): Promise<T[]> => {
  const values: T[] = [];
  for await (const value of iterable) values.push(value);
  return values;
};

const githubResponse = (value: unknown): Response =>
  new Response(JSON.stringify(value), { status: 200 });

describe("credential-bound GitHub provider", () => {
  it("binds the credential once and streams repository/Kind outcomes", async () => {
    const requests: Request[] = [];
    const definition = createGithubProvider(async (input, init) => {
      requests.push(new Request(input, init));
      return githubResponse([]);
    });

    const bound = await definition.bind("secret-token");
    const outcomes = await collect(bound.fetchSlices({
      scope: { repos: ["acme-corp/web"] },
      slices: [{ target: "acme-corp/web", kind: "issue" }],
      signal: new AbortController().signal,
    }));

    expect(outcomes[0]).toMatchObject({
      type: "changed",
      target: "acme-corp/web",
      kind: "issue",
    });
    expect(JSON.stringify(outcomes)).not.toContain("secret-token");
    expect(requests[0].headers.get("authorization")).toBe("Bearer secret-token");
  });
});
