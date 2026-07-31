import { describe, expect, it } from "vitest";
import {
  assertSelfContainedHtml,
  assertSingleArtifact,
} from "../../scripts/check-build.mjs";

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
    ).toThrow("single-file invariant");
  });

  it.each([
    '<script src="app.js"></script>',
    '<link rel="stylesheet" href="app.css">',
    '<link rel="modulepreload" href="chunk.js">',
  ])("rejects a non-inline runtime asset: %s", (html) => {
    expect(() => assertSelfContainedHtml(`<html>${html}</html>`))
      .toThrow("single-file invariant");
  });

  it("requires triage.html to be the only build artifact", () => {
    expect(() => assertSingleArtifact(["triage.html"])).not.toThrow();
    expect(() => assertSingleArtifact(["triage.html", "assets"]))
      .toThrow("exactly dist/triage.html");
  });

  it("accepts the browser-local handoff host without runtime requests", () => {
    expect(() =>
      assertSelfContainedHtml(
        '<html><div id="handoff-host"></div><script>globalThis.queue = []</script></html>',
      ),
    ).not.toThrow();
  });
});
