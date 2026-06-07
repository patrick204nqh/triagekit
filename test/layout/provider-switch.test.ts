// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderProviderSwitch } from "../../src/runtime/layout/provider-switch";

const make = (html = "") => { const el = document.createElement("div"); el.innerHTML = html; return el; };

describe("renderProviderSwitch", () => {
  it("renders a selector with one active provider when >1", () => {
    const host = make();
    renderProviderSwitch(host, {
      providers: [{ id: "github", label: "github", on: true, live: true },
                  { id: "gitlab", label: "gitlab", on: false, live: false }],
      onSelect: () => {},
    });
    expect(host.querySelectorAll("[data-prov]").length).toBe(2);
    expect(host.querySelector("[data-prov='github']")!.className).toContain("on");
    expect(host.querySelector("[data-prov='gitlab']")!.className).toContain("up"); // upcoming
  });
  it("renders a static chip when exactly one provider", () => {
    const host = make();
    renderProviderSwitch(host, {
      providers: [{ id: "cloudflare", label: "cloudflare", on: true, live: true }],
      onSelect: () => {},
    });
    expect(host.querySelector(".prov-chip")).not.toBeNull();
    expect(host.querySelectorAll("[data-prov]").length).toBe(0);
  });
  it("fires onSelect only for live providers", () => {
    const host = make(); let picked = "";
    renderProviderSwitch(host, {
      providers: [{ id: "github", label: "github", on: true, live: true },
                  { id: "gitlab", label: "gitlab", on: false, live: false }],
      onSelect: (id) => { picked = id; },
    });
    host.querySelector<HTMLElement>("[data-prov='gitlab']")!.click();
    expect(picked).toBe("");           // upcoming is not selectable
    host.querySelector<HTMLElement>("[data-prov='github']")!.click();
    expect(picked).toBe("github");
  });
});
