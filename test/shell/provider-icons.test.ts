import { describe, it, expect } from "vitest";
import { providerIcon, categoryIcon } from "../../src/runtime/shell/provider-icons";

describe("providerIcon", () => {
  it("returns a brand path for known providers", () => {
    const svg = providerIcon("github");
    expect(svg).toContain("<path");
    expect(svg).toContain('fill="currentColor"');     // themeable
  });
  it("carries a brand glyph for aws (vendored from CoreUI on a 32×32 grid)", () => {
    const svg = providerIcon("aws");
    expect(svg).toContain("<path");
    expect(svg).not.toContain("prov-mono");           // a real mark, not the fallback
    expect(svg).toContain('viewBox="0 0 32 32"');     // per-provider viewBox override
  });
  it("falls back to a lettered monogram for unknown providers", () => {
    const svg = providerIcon("slack");
    expect(svg).toContain("prov-mono");
    expect(svg).toContain(">S<");                      // first letter, uppercased
  });
  it("honors a custom size", () => {
    expect(providerIcon("gitlab", 22)).toContain('width="22"');
  });
});

describe("categoryIcon", () => {
  it("returns a stroke glyph with the cat-icon class", () => {
    const svg = categoryIcon("scoring");
    expect(svg).toContain("<svg");
    expect(svg).toContain('stroke-width="1.6"');
    expect(svg).toContain('class="cat-icon"');
  });
});
