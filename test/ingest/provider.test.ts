import { describe, it, expect } from "vitest";
import { providerOf, type Source } from "../../src/runtime/ingest/source";

const base: Omit<Source, "id" | "provider"> = {
  domain: "code-security", kinds: ["dependency-vuln"], connectSrc: [], status: "ready",
  scopeSchema: [], fetch: async () => ({ items: [], errors: [] }),
};

describe("providerOf", () => {
  it("falls back to the source id when provider is unset", () => {
    expect(providerOf({ ...base, id: "github" } as Source)).toBe("github");
  });
  it("uses the explicit provider when set", () => {
    expect(providerOf({ ...base, id: "github-review", provider: "github" } as Source)).toBe("github");
  });
});
