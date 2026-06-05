import { describe, it, expect } from "vitest";
import { providerIcon } from "../../src/runtime/shell/provider-icons";

describe("providerIcon", () => {
  it("returns a brand path for known providers", () => {
    const svg = providerIcon("github");
    expect(svg).toContain("<path");
    expect(svg).toContain('fill="currentColor"');     // themeable
  });
  it("falls back to a lettered monogram for unknown providers", () => {
    const svg = providerIcon("aws");
    expect(svg).toContain("prov-mono");
    expect(svg).toContain(">A<");                      // first letter, uppercased
  });
  it("honors a custom size", () => {
    expect(providerIcon("gitlab", 22)).toContain('width="22"');
  });
});
