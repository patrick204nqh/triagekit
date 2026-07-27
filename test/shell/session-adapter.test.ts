// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { TriageConfigT } from "../../src/config/schema";
import { createStore } from "../../src/runtime/core/store";
import { mountShell } from "../../src/runtime/shell/app-shell";
import { createTriageSession } from "../../src/runtime/session/triage-session";
import { testCatalog } from "../support/test-catalog";

const config: TriageConfigT = {
  source: "github",
  views: ["code-security", "insights"],
  scope: {},
  branding: { title: "Acme Triage" },
};

describe("shell Session adapter", () => {
  it("contains no legacy navigation state owner", () => {
    const source = readFileSync(
      join(process.cwd(), "src/runtime/shell/app-shell.ts"),
      "utf8",
    );
    for (const forbidden of [
      "toolbarPropsFromShell",
      "let activeProvider",
      "let repoView",
      "let filterState",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    history.replaceState(null, "", "/");
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: true,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }));
    document.body.innerHTML = `
      <header id="appbar"></header>
      <nav id="domainRail"></nav>
      <nav id="viewswitch"></nav>
      <main id="root"></main>
      <div id="settings-host"></div>
    `;
  });

  it("forwards transitions and executes their work intent", () => {
    const catalog = testCatalog();
    const session = createTriageSession({ catalog });
    const selectProvider = vi.spyOn(session, "selectProvider");
    const changeFilters = vi.spyOn(session, "changeFilters");
    const core = {
      refreshNow: vi.fn(async () => {}),
      rerender: vi.fn(),
      startAutoRefresh: vi.fn(() => () => {}),
    };
    const sessionUrl = {
      read: vi.fn(() => ({})),
      write: vi.fn(),
    };

    mountShell(config, {
      catalog,
      session,
      sessionUrl,
      store: createStore(),
      timer: { every: () => () => {} },
      createCore: () => core,
      createDomView: () => ({ render: () => {} }),
    });
    core.refreshNow.mockClear();
    core.rerender.mockClear();

    document.querySelector<HTMLElement>('[data-prov="gitlab"]')!.click();
    expect(selectProvider).toHaveBeenCalledWith("gitlab");
    expect(core.refreshNow).toHaveBeenCalledTimes(1);

    document.querySelector<HTMLElement>('[data-sort="recent"]')!.click();
    expect(changeFilters).toHaveBeenCalledWith(
      expect.objectContaining({ sort: "recent" }),
    );
    expect(core.rerender).toHaveBeenCalledTimes(1);
    expect(sessionUrl.write).toHaveBeenCalled();
  });
});
