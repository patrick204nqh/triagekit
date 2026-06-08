// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { installAvatarFallback } from "../../src/runtime/layout/atoms/avatar-fallback";

describe("installAvatarFallback", () => {
  it("replaces a broken avatar img with its initials span", () => {
    installAvatarFallback();
    document.body.innerHTML = `<span class="actor"><img class="av av-img" src="x" alt="dkohl" data-initials="DK"></span>`;
    const img = document.querySelector("img.av-img")!;
    img.dispatchEvent(new Event("error", { bubbles: false }));
    expect(document.querySelector("img.av-img")).toBeNull();
    const span = document.querySelector(".actor .av")!;
    expect(span.textContent).toBe("DK");
  });
});
