// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { CredStore } from "../../src/runtime/shell/cred-store";

describe("CredStore", () => {
  beforeEach(() => sessionStorage.clear());
  it("stores and reads a credential per source", () => {
    const c = new CredStore();
    expect(c.has("github")).toBe(false);
    c.set("github", "tok"); c.set("aws", "key");
    expect(c.get("github")).toBe("tok");
    expect(c.has("aws")).toBe(true);
  });
  it("clears when set empty", () => {
    const c = new CredStore(); c.set("github", "tok"); c.set("github", "");
    expect(c.has("github")).toBe(false);
  });
});
