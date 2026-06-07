// test/adapters/local-storage.test.ts
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { createLocalStorage } from "../../src/runtime/adapters/local-storage";

describe("localStorage adapter", () => {
  it("round-trips through window.localStorage", () => {
    const s = createLocalStorage();
    s.set("triage.x", "1");
    expect(s.get("triage.x")).toBe("1");
    expect(s.get("missing")).toBeNull();
  });
});
