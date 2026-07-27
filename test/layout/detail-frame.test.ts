// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { runtimeCatalog } from "../../src/runtime/catalog/built-in";
import type { RuntimeCatalog } from "../../src/runtime/catalog/types";
import { renderTriageList } from "../../src/runtime/layout/table/detail-panel";
import type {
  KindRenderer,
  ScoredItem,
} from "../../src/runtime/layout/table/kind-renderer";

const row = (): ScoredItem => ({
  id: "x:1", provider: "github", providerRef: {}, kind: "stub-kind", title: "Row one",
  url: "https://example.com/1", createdAt: new Date().toISOString(),
  score: 10, tier: "P2", details: {},
} as unknown as ScoredItem);

let catalog: RuntimeCatalog;

beforeEach(() => {
  document.body.innerHTML = "";
  const renderer: KindRenderer = {
    kind: "stub-kind" as any,
    columns: [{ header: "Title", cell: (r) => r.title }],
    detail: (item) => ({
        header: { title: item.title, tier: item.tier, provider: item.provider, ref: { text: "#7", href: "https://e/7" } },
      body: (host) => { host.innerHTML = `<p class="stub-body">hello body</p>`; },
      actions: (host) => { host.innerHTML = `<a data-action="open" href="${item.url}">Open ↗</a>`; },
    }),
  };
  catalog = {
    ...runtimeCatalog,
    readyKind: (kind) => kind === renderer.kind
      ? { renderer } as ReturnType<RuntimeCatalog["readyKind"]>
      : runtimeCatalog.readyKind(kind),
  };
});

describe("DetailFrame", () => {
  it("opens a drawer with header (provider icon, not literal text), body, and footer", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    renderTriageList(root, [row()], [], {}, catalog);
    root.querySelector<HTMLElement>(".alert-row")!.click();

    const drawer = root.querySelector<HTMLElement>(".drawer")!;
    expect(drawer.hidden).toBe(false);
    expect(drawer.querySelector(".drawer-head .prov-icon")).toBeTruthy();
    expect(drawer.querySelector(".drawer-head")!.textContent).not.toMatch(/github/i);
    expect(drawer.querySelector(".drawer-content .stub-body")).toBeTruthy();
    expect(drawer.querySelector(".drawer-foot [data-action='open']")).toBeTruthy();
  });
});
