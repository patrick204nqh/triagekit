// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { runtimeCatalog } from "../../src/runtime/catalog/built-in";
import type { RuntimeCatalog } from "../../src/runtime/catalog/types";
import { renderTriageList } from "../../src/runtime/layout/table/detail-panel";
import type {
  DetailCtx,
  KindRenderer,
  ScoredItem,
} from "../../src/runtime/layout/table/kind-renderer";

const withRenderer = (renderer: KindRenderer): RuntimeCatalog => ({
  ...runtimeCatalog,
  readyKind: (kind) => kind === renderer.kind
    ? { renderer } as ReturnType<RuntimeCatalog["readyKind"]>
    : runtimeCatalog.readyKind(kind),
});

function row(over: Partial<ScoredItem>): ScoredItem {
  return {
    id: "x", provider: "t", providerRef: {}, kind: "dependency-vuln", title: "log4j", location: "acme/web",
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
    const renderer: KindRenderer = {
      kind: "secret-scanning",
      detail: (i, ctx: DetailCtx) => {
        seen.title = i.title; seen.token = ctx.token;
          return {
            header: { title: i.title, tier: i.tier, provider: i.provider },
          body: (host) => { host.innerHTML = `<p class="probe">${i.title}</p>`; },
        };
      },
    };
    const root = document.createElement("div");
    renderTriageList(
      root,
      [row({ kind: "secret-scanning", title: "leaked key" })],
      [],
      { token: "tok" },
      withRenderer(renderer),
    );
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
    renderTriageList(root, [row({ kind: "cloud-misconfig", title: "XSS" })], []);
    (root.querySelector(".alert-row") as HTMLElement).click();
    expect(root.querySelector(".drawer")!.textContent).toContain("XSS");
  });
});
