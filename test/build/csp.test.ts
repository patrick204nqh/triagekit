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
  it("allows inlined fonts via font-src 'self' data:", () => {
    const out = buildCspMeta('<!--CSP-META-PLACEHOLDER--><style>a{}</style>', []);
    expect(out).toMatch(/font-src 'self' data:/);
  });
});
