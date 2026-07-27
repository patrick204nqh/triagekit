import { describe, expect, it } from "vitest";
import type { TriageItem } from "../../src/runtime/dataset/item";

describe("TriageItem Provider identity", () => {
  it("carries normalized provider identity and an opaque Provider Reference", () => {
    const item: TriageItem = {
      id: "github:acme-corp/web:1",
      provider: "github",
      providerRef: { repo: "acme-corp/web", number: 1 },
      kind: "issue",
      title: "Example",
      location: "acme-corp/web",
      signal: 1,
      createdAt: "2026-01-01T00:00:00Z",
      url: "",
      details: {},
    };

    expect(item.provider).toBe("github");
    expect(item.providerRef).toEqual({ repo: "acme-corp/web", number: 1 });
  });
});
