// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { renderTriageList } from "../../src/runtime/layout/table/detail-panel";
import { registerKindRenderer, type ScoredItem, type DetailCtx } from "../../src/runtime/layout/table/kind-renderer";

function row(over: Partial<ScoredItem>): ScoredItem {
  return {
    id: "x", source: "t", kind: "dependency-vuln", title: "log4j", location: "acme/web",
    signal: 10, createdAt: "2026-01-01T00:00:00Z", url: "https://x", details: {},
    score: 100, tier: "P1", ...over,
  } as ScoredItem;
}

describe("renderTriageList + DetailPanel", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("renders one row per item and a hidden drawer", () => {
    const root = document.createElement("div");
    renderTriageList(root, [row({ id: "a" }), row({ id: "b" })], []);
    expect(root.querySelectorAll(".alert-row").length).toBe(2);
    expect(root.querySelector<HTMLElement>(".drawer")!.hidden).toBe(true);
  });

  it("opens the drawer with the row's kind detail, passing ctx", () => {
    const seen: { title?: string; token?: string } = {};
    registerKindRenderer({
      kind: "secret-scanning",
      detail: (i, ctx: DetailCtx) => {
        seen.title = i.title; seen.token = ctx.token;
        return {
          header: { title: i.title, tier: i.tier, provider: i.source },
          body: (host) => { host.innerHTML = `<p class="probe">${i.title}</p>`; },
        };
      },
    });
    const root = document.createElement("div");
    renderTriageList(root, [row({ kind: "secret-scanning", title: "leaked key" })], [], { token: "tok" });
    (root.querySelector(".alert-row") as HTMLElement).click();
    const drawer = root.querySelector<HTMLElement>(".drawer")!;
    expect(drawer.hidden).toBe(false);
    expect(drawer.querySelector(".probe")?.textContent).toBe("leaked key");
    expect(seen).toEqual({ title: "leaked key", token: "tok" });
  });

  it("close button hides the drawer", () => {
    const root = document.createElement("div");
    renderTriageList(root, [row({})], []);
    (root.querySelector(".alert-row") as HTMLElement).click();
    (root.querySelector(".drawer-close") as HTMLElement).click();
    expect(root.querySelector<HTMLElement>(".drawer")!.hidden).toBe(true);
  });

  it("Escape closes the open drawer", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    renderTriageList(root, [row({})], []);
    (root.querySelector(".alert-row") as HTMLElement).click();
    const drawer = root.querySelector<HTMLElement>(".drawer")!;
    expect(drawer.hidden).toBe(false);
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(drawer.hidden).toBe(true);
  });

  it("falls back to a default detail when the kind has no detail()", () => {
    const root = document.createElement("div");
    renderTriageList(root, [row({ kind: "code-scanning", title: "XSS" })], []);
    (root.querySelector(".alert-row") as HTMLElement).click();
    expect(root.querySelector(".drawer")!.textContent).toContain("XSS");
  });
});
