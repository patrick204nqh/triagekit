// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { wirePopovers } from "../../src/runtime/layout/toolbar/toolbar-popover";

// Minimal toolbar fragment: the two trigger buttons + their hidden popovers,
// matching the markup renderToolbar produces.
function fragment(): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = `
    <div class="tb-ctl"><button data-tb-filter></button><div class="tb-pop" data-pop="filter" hidden></div></div>
    <div class="tb-ctl"><button data-tb-sort></button><div class="tb-pop" data-pop="sort" hidden></div></div>`;
  document.body.append(host);   // dismissible's Esc stack listens on document
  return host;
}
const btn = (host: HTMLElement, which: string) => host.querySelector<HTMLElement>(`[data-tb-${which}]`)!;
const pop = (host: HTMLElement, which: string) => host.querySelector<HTMLElement>(`[data-pop="${which}"]`)!;

describe("wirePopovers", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("clicking the filter button opens its popover", () => {
    const host = fragment(); wirePopovers(host);
    expect(pop(host, "filter").hidden).toBe(true);
    btn(host, "filter").click();
    expect(pop(host, "filter").hidden).toBe(false);
  });

  it("clicking the same button again closes it", () => {
    const host = fragment(); wirePopovers(host);
    btn(host, "filter").click();
    btn(host, "filter").click();
    expect(pop(host, "filter").hidden).toBe(true);
  });

  it("opening sort while filter is open closes filter (mutual exclusion)", () => {
    const host = fragment(); wirePopovers(host);
    btn(host, "filter").click();
    btn(host, "sort").click();
    expect(pop(host, "filter").hidden).toBe(true);
    expect(pop(host, "sort").hidden).toBe(false);
  });

  it("Escape dismisses the open popover", () => {
    const host = fragment(); wirePopovers(host);
    btn(host, "filter").click();
    expect(pop(host, "filter").hidden).toBe(false);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(pop(host, "filter").hidden).toBe(true);
  });

  it("a pointerdown outside the popover closes it", () => {
    const host = fragment(); wirePopovers(host);
    btn(host, "filter").click();
    expect(pop(host, "filter").hidden).toBe(false);
    document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    expect(pop(host, "filter").hidden).toBe(true);
  });

  it("a pointerdown inside the popover keeps it open", () => {
    const host = fragment(); wirePopovers(host);
    btn(host, "filter").click();
    pop(host, "filter").dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    expect(pop(host, "filter").hidden).toBe(false);
  });
});
