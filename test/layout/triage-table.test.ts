// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runtimeCatalog } from "../../src/runtime/catalog/built-in";
import type { RuntimeCatalog } from "../../src/runtime/catalog/types";
import { renderTriageList } from "../../src/runtime/layout/table/detail-panel";
import { renderTableSkeleton } from "../../src/runtime/layout/table/triage-table";
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

  it("renders one row per item and a closed drawer", () => {
    const root = document.createElement("div");
    renderTriageList(root, [row({ id: "a" }), row({ id: "b" })], []);
    expect(root.querySelectorAll(".alert-row").length).toBe(2);
    expect(root.querySelector<HTMLDialogElement>(".drawer")!.open).toBe(false);
  });

  it("places the table in a labelled keyboard-scrollable region", () => {
    const root = document.createElement("div");
    renderTriageList(root, [row({ id: "a" })], []);

    const region = root.querySelector<HTMLElement>(
      '[role="region"][aria-label="Triage items"]',
    )!;
    expect(region.tabIndex).toBe(0);
    expect(region.querySelector("table.alerts")).not.toBeNull();
  });

  it("places the loading skeleton in a labelled keyboard-scrollable region", () => {
    const root = document.createElement("div");
    renderTableSkeleton(root);

    const region = root.querySelector<HTMLElement>(
      '[role="region"][aria-label="Loading triage items"]',
    )!;
    expect(region.tabIndex).toBe(0);
    expect(region.querySelector("table.alerts")).not.toBeNull();
  });

  it("uses a dedicated detail button instead of making the table row a button", () => {
    const root = document.createElement("div");
    renderTriageList(root, [row({ id: "a", title: "Review auth flow" })], []);

    const tableRow = root.querySelector<HTMLElement>(".alert-row")!;
    expect(tableRow.hasAttribute("role")).toBe(false);
    expect(tableRow.hasAttribute("tabindex")).toBe(false);

    const detailButton = tableRow.querySelector<HTMLButtonElement>(
      "[data-open-detail]",
    )!;
    expect(detailButton.textContent).toBe("Review auth flow");
    detailButton.click();
    expect(root.querySelector<HTMLDialogElement>(".drawer")!.open).toBe(true);
  });

  it("groups repeated failures in a collapsed repository disclosure", () => {
    const root = document.createElement("div");
    const failure = {
      provider: "github",
      kind: "code-scanning" as const,
      category: "scope" as const,
      message: "Code Security must be enabled",
    };

    renderTriageList(root, [], [
      { ...failure, target: "acme-corp/web" },
      { ...failure, target: "acme-corp/api" },
    ]);

    const warning = root.querySelector<HTMLDetailsElement>(
      "details.warnings",
    )!;
    expect(warning.open).toBe(false);
    expect(warning.querySelector("summary")?.textContent)
      .toContain("Code scanning unavailable in 2 repositories");
    expect(warning.querySelectorAll("[data-warning-cause]")).toHaveLength(1);
    expect(warning.querySelector("[data-warning-cause]")?.textContent)
      .toContain("Code Security must be enabled");
    expect(
      [...warning.querySelectorAll("[data-warning-repository]")]
        .map((node) => node.textContent),
    ).toEqual(["acme-corp/api", "acme-corp/web"]);
    expect(warning.querySelector("[role='alert']")).toBeNull();

    renderTriageList(root, [], [
      { ...failure, target: "acme-corp/web" },
    ]);
    expect(root.querySelector("summary")?.textContent)
      .toContain("Code scanning unavailable in 1 repository");
  });

  it("toggles queue selection without opening the detail drawer", () => {
    const root = document.createElement("div");
    const selected: string[] = [];
    renderTriageList(
      root,
      [row({ id: "a" })],
      [],
      {
        handoffSelection: {
          queuedKeys: new Set(),
          onToggle: (item) => selected.push(item.id),
        },
      },
    );
    const toggle = root.querySelector<HTMLButtonElement>(
      "[data-queue-select]",
    )!;
    toggle.click();
    expect(selected).toEqual(["a"]);
    expect(root.querySelector<HTMLDialogElement>(".drawer")!.open).toBe(false);
  });

  it("uses the queue as the only item-level Handoff action", () => {
    const root = document.createElement("div");
    const item = row({ id: "a", title: "Investigate auth failure" });
    const onToggle = vi.fn();
    renderTriageList(root, [item], [], {
      handoffSelection: {
        queuedKeys: new Set(),
        onToggle,
      },
    });

    root.querySelector<HTMLElement>(".alert-row")!.click();

    expect(root.querySelector("[data-brief-gen]")).toBeNull();
    expect(root.textContent).not.toContain("Generate brief");
    const detailAction = root.querySelector<HTMLElement>(
      "[data-detail-handoff-toggle]",
    )!;
    expect(detailAction.textContent).toBe("Add to handoff");
    detailAction.click();
    expect(onToggle).toHaveBeenCalledWith(item);
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
    const drawer = root.querySelector<HTMLDialogElement>(".drawer")!;
    expect(drawer.open).toBe(true);
    expect(drawer.querySelector(".probe")?.textContent).toBe("leaked key");
    expect(seen).toEqual({ title: "leaked key", token: "tok" });
  });

  it("close button hides the drawer", () => {
    const root = document.createElement("div");
    renderTriageList(root, [row({})], []);
    (root.querySelector(".alert-row") as HTMLElement).click();
    (root.querySelector(".drawer-close") as HTMLElement).click();
    expect(root.querySelector<HTMLDialogElement>(".drawer")!.open).toBe(false);
  });

  it("moves focus into the modal drawer and restores it on close", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    renderTriageList(root, [row({ title: "Review auth flow" })], []);
    const detailButton = root.querySelector<HTMLButtonElement>(
      "[data-open-detail]",
    )!;
    detailButton.focus();
    detailButton.click();

    const drawer = root.querySelector<HTMLDialogElement>(".drawer")!;
    const titleId = drawer.getAttribute("aria-labelledby")!;
    expect(titleId).not.toBe("");
    expect(drawer.querySelector(`#${titleId}`)?.textContent?.trim())
      .not.toBe("");
    expect(document.activeElement).toBe(
      drawer.querySelector(".drawer-close"),
    );
    drawer.querySelector<HTMLButtonElement>(".drawer-close")!.click();
    expect(document.activeElement).toBe(detailButton);
  });

  it("reopens saved detail as a modal dialog", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    renderTriageList(
      root,
      [row({ id: "saved", title: "Saved detail" })],
      [],
      {},
      runtimeCatalog,
      { activeItemId: "saved" },
    );

    const drawer = root.querySelector<HTMLDialogElement>(".drawer")!;
    expect(drawer.open).toBe(true);
    drawer.querySelector<HTMLButtonElement>(".drawer-close")!.click();
    expect(drawer.open).toBe(false);
  });

  it("uses a unique accessible heading for each detail drawer", () => {
    const first = document.createElement("div");
    const second = document.createElement("div");
    renderTriageList(first, [row({ id: "a" })], []);
    renderTriageList(second, [row({ id: "b" })], []);
    first.querySelector<HTMLElement>(".alert-row")!.click();
    second.querySelector<HTMLElement>(".alert-row")!.click();

    const firstDrawer = first.querySelector<HTMLElement>(".drawer")!;
    const secondDrawer = second.querySelector<HTMLElement>(".drawer")!;
    const firstId = firstDrawer.getAttribute("aria-labelledby")!;
    const secondId = secondDrawer.getAttribute("aria-labelledby")!;
    expect(firstId).not.toBe(secondId);
    expect(firstDrawer.querySelector(`#${firstId}`)).not.toBeNull();
    expect(secondDrawer.querySelector(`#${secondId}`)).not.toBeNull();
  });

  it("native cancel closes the open drawer", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    renderTriageList(root, [row({})], []);
    (root.querySelector(".alert-row") as HTMLElement).click();
    const drawer = root.querySelector<HTMLDialogElement>(".drawer")!;
    expect(drawer.open).toBe(true);
    drawer.dispatchEvent(new Event("cancel", { cancelable: true }));
    expect(drawer.open).toBe(false);
  });

  it("falls back to a default detail when the kind has no detail()", () => {
    const root = document.createElement("div");
    renderTriageList(root, [row({ kind: "cloud-misconfig", title: "XSS" })], []);
    (root.querySelector(".alert-row") as HTMLElement).click();
    expect(root.querySelector(".drawer")!.textContent).toContain("XSS");
  });
});
