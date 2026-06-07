import { describe, it, expect } from "vitest";
import { registerProvider, getProvider, listProviders } from "../../src/runtime/core/provider-registry";
import type { ProviderManifest } from "../../src/runtime/core/manifest";

const fake = (id: string): ProviderManifest => ({
  id,
  domain: "code-security",
  kinds: ["issue"],
  labels: { issue: "Tickets" },
  makeAdapter: () => ({} as any),
});

describe("provider-registry", () => {
  it("round-trips registered providers through getProvider", () => {
    const m = fake("demo-a");
    registerProvider(m);
    expect(getProvider("demo-a")).toBe(m);
  });

  it("returns undefined for an unregistered id", () => {
    expect(getProvider("never-registered")).toBeUndefined();
  });

  it("listProviders includes registered providers", () => {
    const m = fake("demo-b");
    registerProvider(m);
    expect(listProviders()).toContain(m);
  });
});
