// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { ScopeStore } from "../../src/runtime/shell/scope-store";

describe("ScopeStore", () => {
  beforeEach(() => localStorage.clear());
  it("round-trips a per-source scope bag", () => {
    const s = new ScopeStore();
    expect(s.get("github")).toEqual({});
    s.set("github", { repos: ["acme/web", "acme/api"] });
    expect(s.get("github")).toEqual({ repos: ["acme/web", "acme/api"] });
  });
  it("returns {} on corrupt data", () => {
    localStorage.setItem("triagekit.scope.github", "not json");
    expect(new ScopeStore().get("github")).toEqual({});
  });
});
