import { describe, it, expect } from "vitest";
import { buildCspMeta } from "../../src/vite/csp-plugin";

describe("buildCspMeta", () => {
  it("emits script-src with a sha256 hash and the provider connect-src", () => {
    const html = '<!--CSP-META-PLACEHOLDER--><script>console.log(1)</script>';
    const out = buildCspMeta(html, ["https://api.github.com"]);
    expect(out).toMatch(/script-src 'sha256-/);
    expect(out).toMatch(/connect-src 'self' https:\/\/api\.github\.com/);
    expect(out).not.toContain("unsafe-inline");
  });
});
