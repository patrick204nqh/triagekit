import { describe, it, expect } from "vitest";
import { isCompiledConfig } from "../../src/runtime/shell/mode";

describe("isCompiledConfig", () => {
  it("is compiled when a non-empty scope bag is baked in", () => {
    expect(isCompiledConfig({ scope: { repos: ["acme/web"] } })).toBe(true);
  });
  it("is generic when scope is undefined", () => {
    expect(isCompiledConfig({ scope: undefined })).toBe(false);
  });
  it("is generic when scope is an empty bag", () => {
    expect(isCompiledConfig({ scope: {} })).toBe(false);
  });
});
