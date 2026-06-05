import { describe, it, expect } from "vitest";
import { registerSource, getSource, listSources, allConnectSrc, type Source } from "../../src/runtime/ingest/source";

const fake: Source = {
  id: "fake", domain: "code-security", kinds: ["dependency-vuln"],
  connectSrc: ["https://x.test"], status: "ready", scopeSchema: [],
  fetch: async () => ({ items: [], errors: [] }),
};

describe("source registry", () => {
  it("registers and resolves a source", () => {
    registerSource(fake);
    expect(getSource("fake").domain).toBe("code-security");
    expect(listSources().some(s => s.id === "fake")).toBe(true);
    expect(allConnectSrc()).toContain("https://x.test");
  });
  it("throws on unknown id", () => { expect(() => getSource("nope")).toThrow(/unknown source/); });
});
