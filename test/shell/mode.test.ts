import { describe, it, expect } from "vitest";
import { isCompiledConfig } from "../../src/runtime/shell/mode";

describe("isCompiledConfig", () => {
  it("is compiled when org and at least one repo are baked in", () => {
    expect(isCompiledConfig({ org: "acme-corp", repos: ["web-app"] })).toBe(true);
  });
  it("is generic when org is empty", () => {
    expect(isCompiledConfig({ org: "", repos: ["web-app"] })).toBe(false);
  });
  it("is generic when there are no repos", () => {
    expect(isCompiledConfig({ org: "acme-corp", repos: [] })).toBe(false);
  });
});
