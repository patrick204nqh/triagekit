import { afterEach, describe, expect, it, vi } from "vitest";
import { ghGraphQL } from "../../../src/runtime/ingest/github/graphql";

afterEach(() => vi.restoreAllMocks());

describe("ghGraphQL", () => {
  it("POSTs query+variables to the GraphQL endpoint with a bearer token", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await ghGraphQL("tok", "query{x}", { a: 1 });
    expect(out.data).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.github.com/graphql");
    expect((init as RequestInit).method).toBe("POST");
    expect(((init as RequestInit).headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ query: "query{x}", variables: { a: 1 } });
  });

  it("throws on non-ok HTTP", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 401 })));
    await expect(ghGraphQL("tok", "q", {})).rejects.toThrow("401");
  });
});
