// test/providers/github.test.ts
import { describe, it, expect } from "vitest";
import { github } from "../../src/runtime/providers/github";

describe("github provider manifest", () => {
  it("declares id, domain, kinds and builds an adapter exposing fetch", () => {
    expect(github.id).toBe("github");
    expect(github.kinds).toEqual(expect.arrayContaining(["dependency-vuln", "change-request", "issue"]));
    const adapter = github.makeAdapter({});
    expect(typeof adapter.fetch).toBe("function");
  });
  it("declares provider-neutral kinds with display labels", () => {
    expect(github.kinds).toContain("change-request");
    expect(github.kinds).not.toContain("pull-request");
    expect(github.labels?.["change-request"]).toBe("Pull request");
  });
});
