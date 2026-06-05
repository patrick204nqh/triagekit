import { describe, it, expect } from "vitest";
import { registerSurface, resolveSurface, type SurfaceRenderer } from "../../src/runtime/layout/surface";

describe("surface registry", () => {
  it("returns the registered renderer for an artifact id, undefined otherwise", () => {
    const noop: SurfaceRenderer = () => {};
    registerSurface("test-artifact", noop);
    expect(resolveSurface("test-artifact")).toBe(noop);
    expect(resolveSurface("no-such-artifact")).toBeUndefined();
  });
});
