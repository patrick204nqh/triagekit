// test/providers/github.test.ts
import { describe, it, expect } from "vitest";
import { github } from "../../src/runtime/providers/github";

describe("github provider manifest", () => {
  it("declares id, domain, kinds and builds an adapter exposing fetch", () => {
    expect(github.id).toBe("github");
    expect(github.kinds).toEqual(expect.arrayContaining(["dependency-vuln", "pull-request", "issue"]));
    const adapter = github.makeAdapter({});
    expect(typeof adapter.fetch).toBe("function");
  });
});
