// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getThemeChoice, setThemeChoice, resolveTheme, applyTheme } from "../../src/runtime/shell/theme";

function mockSystem(dark: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: dark, media: q, addEventListener() {}, removeEventListener() {} }) as any);
}

describe("theme", () => {
  beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute("data-theme"); });

  it("defaults to auto and resolves from system preference", () => {
    mockSystem(true);
    expect(getThemeChoice()).toBe("auto");
    expect(resolveTheme("auto")).toBe("dark");
    mockSystem(false);
    expect(resolveTheme("auto")).toBe("light");
  });

  it("persists a pinned choice and applies it to <html>", () => {
    mockSystem(true);              // system is dark…
    setThemeChoice("light");       // …but user pins light
    expect(getThemeChoice()).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("clears storage when reset to auto", () => {
    mockSystem(false);
    setThemeChoice("dark");
    expect(localStorage.getItem("triagekit.theme")).toBe("dark");
    setThemeChoice("auto");
    expect(localStorage.getItem("triagekit.theme")).toBeNull();
    applyTheme("auto");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});
