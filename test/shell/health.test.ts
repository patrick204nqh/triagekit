// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { healthOf, scopeSummary } from "../../src/runtime/shell/health";
import { CredStore } from "../../src/runtime/shell/cred-store";
import type { Source } from "../../src/runtime/ingest/source";

const mk = (over: Partial<Source>): Source => ({
  id: "github", domain: "code-security", kinds: ["dependency-vuln"], connectSrc: [],
  status: "ready", scopeSchema: [{ key: "repos", label: "Repositories", type: "multiselect" }],
  fetch: async () => ({ items: [], errors: [] }), ...over,
});

describe("health", () => {
  beforeEach(() => sessionStorage.clear());
  it("upcoming sources are always 'upcoming'", () => {
    expect(healthOf(mk({ status: "upcoming" }), new CredStore())).toBe("upcoming");
  });
  it("ready source is needs-token until a credential exists", () => {
    const c = new CredStore();
    expect(healthOf(mk({}), c)).toBe("needs-token");
    c.set("github", "t"); expect(healthOf(mk({}), c)).toBe("connected");
  });
  it("summarizes multiselect scope fields, else 'scope not set'", () => {
    expect(scopeSummary(mk({}), {})).toBe("scope not set");
    expect(scopeSummary(mk({}), { repos: ["a", "b", "c"] })).toBe("3 repositories");
  });
});
