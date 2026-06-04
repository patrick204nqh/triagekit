// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { TokenStore } from "../../src/runtime/shell/storage";

describe("TokenStore", () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear(); });

  it("defaults to sessionStorage (not persisted across browser sessions)", () => {
    const s = new TokenStore();
    s.set("ghp_x");
    expect(sessionStorage.getItem("triagekit.token")).toBe("ghp_x");
    expect(localStorage.getItem("triagekit.token")).toBeNull();
  });

  it("only uses localStorage when remember=true is explicitly chosen", () => {
    const s = new TokenStore();
    s.set("ghp_y", { remember: true });
    expect(localStorage.getItem("triagekit.token")).toBe("ghp_y");
  });
});
