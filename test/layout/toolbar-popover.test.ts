// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { wirePopovers } from "../../src/runtime/layout/toolbar/toolbar-popover";
import { installNativeOverlayDoubles } from "../helpers/native-overlays";

function fragment(): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = `
    <div class="tb-ctl"><button data-tb-filter></button><div class="tb-pop" data-pop="filter"></div></div>
    <div class="tb-ctl"><button data-tb-sort></button><div class="tb-pop" data-pop="sort"></div></div>`;
  return host;
}

const btn = (host: HTMLElement, which: string) =>
  host.querySelector<HTMLButtonElement>(`[data-tb-${which}]`)!;
const pop = (host: HTMLElement, which: string) =>
  host.querySelector<HTMLElement>(`[data-pop="${which}"]`)!;

describe("wirePopovers", () => {
  beforeEach(installNativeOverlayDoubles);

  it("configures filter and sort as auto popovers", () => {
    const host = fragment();
    wirePopovers(host);

    for (const which of ["filter", "sort"]) {
      const trigger = btn(host, which);
      const surface = pop(host, which);
      expect(surface.getAttribute("popover")).toBe("auto");
      expect(trigger.popoverTargetElement).toBe(surface);
    }
  });

  it("syncs expanded state from native toggle events", () => {
    const host = fragment();
    wirePopovers(host);
    const trigger = btn(host, "filter");
    const surface = pop(host, "filter");

    surface.showPopover();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    surface.hidePopover();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
});
