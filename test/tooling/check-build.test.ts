import { describe, expect, it } from "vitest";
import { assertSelfContainedHtml } from "../../scripts/check-build.mjs";

describe("build smoke assertion", () => {
  it("accepts inline scripts", () => {
    expect(() =>
      assertSelfContainedHtml("<html><script>globalThis.ok = true</script></html>"),
    ).not.toThrow();
  });

  it("rejects external scripts", () => {
    expect(() =>
      assertSelfContainedHtml(
        '<html><script src="https://cdn.example.invalid/app.js"></script></html>',
      ),
    ).toThrow("external script");
  });
});
