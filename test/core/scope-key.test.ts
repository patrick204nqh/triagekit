// test/core/scope-key.test.ts
import { describe, it, expect } from "vitest";
import { scopeKey } from "../../src/runtime/core/scope-key";

describe("scopeKey", () => {
  it("is stable regardless of key order", () => {
    expect(scopeKey({ repos: ["a", "b"], org: "x" })).toBe(scopeKey({ org: "x", repos: ["a", "b"] }));
  });
  it("differs when values differ", () => {
    expect(scopeKey({ repos: ["a"] })).not.toBe(scopeKey({ repos: ["b"] }));
  });
  it("handles empty scope", () => {
    expect(scopeKey({})).toBe("{}");
  });
});
