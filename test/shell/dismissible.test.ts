// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { dismissible } from "../../src/runtime/shell/dismissible";

function esc() {
  document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
}

describe("dismissible", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("Escape dismisses an active surface but not a released one", () => {
    const panel = document.createElement("div");
    document.body.appendChild(panel);
    const onDismiss = vi.fn();
    const h = dismissible(panel, { onDismiss });

    esc();
    expect(onDismiss).not.toHaveBeenCalled(); // not active yet

    h.activate();
    esc();
    expect(onDismiss).toHaveBeenCalledTimes(1);

    h.release();
    esc();
    expect(onDismiss).toHaveBeenCalledTimes(1); // released — no further dismiss
  });

  it("Escape closes only the topmost open surface", () => {
    const p1 = document.createElement("div"); const p2 = document.createElement("div");
    document.body.append(p1, p2);
    const d1 = vi.fn(); const d2 = vi.fn();
    const h1 = dismissible(p1, { onDismiss: d1 });
    const h2 = dismissible(p2, { onDismiss: d2 });

    h1.activate();
    h2.activate();
    esc();
    expect(d2).toHaveBeenCalledTimes(1);
    expect(d1).not.toHaveBeenCalled();

    h2.release();
    esc();
    expect(d1).toHaveBeenCalledTimes(1);
  });

  it("scrim click dismisses", () => {
    const panel = document.createElement("div");
    const scrim = document.createElement("div");
    document.body.append(scrim, panel);
    const onDismiss = vi.fn();
    const h = dismissible(panel, { onDismiss, scrim });

    scrim.click();
    expect(onDismiss).not.toHaveBeenCalled(); // not active

    h.activate();
    scrim.click();
    expect(onDismiss).toHaveBeenCalledTimes(1);

    h.release();
    scrim.click();
    expect(onDismiss).toHaveBeenCalledTimes(1); // listener removed on release
  });

  it("returns focus to the trigger on release", () => {
    const trigger = document.createElement("button");
    const panel = document.createElement("div");
    document.body.append(trigger, panel);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const h = dismissible(panel, { onDismiss: () => {}, restoreFocus: true });
    h.activate();
    (document.body as HTMLElement).focus?.();
    h.release();
    expect(document.activeElement).toBe(trigger);
  });

  it("modal inerts the background and clears it on release", () => {
    const bg = document.createElement("div");
    const host = document.createElement("div");
    const panel = document.createElement("div");
    host.appendChild(panel);
    document.body.append(bg, host);
    const h = dismissible(panel, { onDismiss: () => {}, modal: true });

    h.activate();
    expect(bg.hasAttribute("inert")).toBe(true);
    expect(host.hasAttribute("inert")).toBe(false); // host contains the panel

    h.release();
    expect(bg.hasAttribute("inert")).toBe(false);
  });

  it("modal traps Tab from the last focusable back to the first", () => {
    const panel = document.createElement("div");
    const a = document.createElement("button");
    const b = document.createElement("button");
    panel.append(a, b);
    document.body.appendChild(panel);
    const h = dismissible(panel, { onDismiss: () => {}, modal: true });

    h.activate();
    b.focus();
    expect(document.activeElement).toBe(b);
    const ev = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    b.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(a); // wrapped to first
  });

  it("non-modal surfaces do not inert the background", () => {
    const bg = document.createElement("div");
    const panel = document.createElement("div");
    document.body.append(bg, panel);
    const h = dismissible(panel, { onDismiss: () => {} });
    h.activate();
    expect(bg.hasAttribute("inert")).toBe(false);
    h.release();
  });
});
