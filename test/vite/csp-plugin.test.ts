import { describe, it, expect } from "vitest";
import { buildCspMeta, SOURCE_IMG_SRC } from "../../src/vite/csp-plugin";

describe("buildCspMeta img-src", () => {
  const html = `<!--CSP-META-PLACEHOLDER--><script>1</script><style>a{}</style>`;

  it("keeps the baseline self + data: img sources", () => {
    const meta = buildCspMeta(html, []);
    expect(meta).toMatch(/img-src 'self' data:/);
  });

  it("appends the github avatar/usercontent hosts", () => {
    const meta = buildCspMeta(html, [], SOURCE_IMG_SRC.github);
    expect(meta).toContain("https://avatars.githubusercontent.com");
    expect(meta).toContain("https://*.githubusercontent.com");
  });
});
