// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mountRepositorySettings,
  type RepositoryWorkspaceChange,
  type RepositoryWorkspaceSnapshot,
} from "../../src/runtime/shell/repository-settings";

function mount(options?: {
  connected?: boolean;
  repositories?: string[];
  discover?: () => Promise<readonly {
    value: string;
    label: string;
    group?: string;
  }[]>;
}) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  let state: RepositoryWorkspaceSnapshot = {
    provider: "github",
    connected: options?.connected ?? true,
    repositories: options?.repositories ?? [
      "acme-corp/core",
      "acme-corp/web",
    ],
    repositoryOrder: options?.repositories ?? [
      "acme-corp/core",
      "acme-corp/web",
    ],
    discoveryKey: "github:credential",
  };
  const change = vi.fn((provider: string, next: RepositoryWorkspaceChange) => {
    state = { ...state, ...next, provider };
  });
  const discover = vi.fn(options?.discover ?? (async () => [
    { value: "acme-corp/core", label: "core", group: "acme-corp" },
    { value: "acme-corp/web", label: "web", group: "acme-corp" },
    { value: "acme-corp/api", label: "api", group: "acme-corp" },
  ]));
  const openConnections = vi.fn();
  const controller = mountRepositorySettings(host, {
    providers: ["github"],
    snapshot: () => state,
    discover,
    change,
    openConnections,
  });
  return { host, controller, change, discover, openConnections };
}

function names(host: HTMLElement, selector: string): string[] {
  return [...host.querySelectorAll<HTMLElement>(selector)]
    .map((element) => element.dataset.repository ?? "");
}

function click(host: HTMLElement, selector: string): void {
  const element = host.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Missing ${selector}`);
  element.click();
}

async function clickAndFlush(host: HTMLElement, selector: string): Promise<void> {
  click(host, selector);
  await Promise.resolve();
  await Promise.resolve();
}

describe("mountRepositorySettings", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("renders selected repositories and moves repositories between complete lists", async () => {
    const { host, controller, change } = mount();

    controller.show("github");
    expect(names(host, "[data-selected-repository]")).toEqual([
      "acme-corp/core",
      "acme-corp/web",
    ]);

    await clickAndFlush(host, "[data-discover-repositories]");
    expect(names(host, "[data-available-repository]")).toEqual([
      "acme-corp/api",
    ]);

    click(host, '[data-add-repository="acme-corp/api"]');
    expect(change).toHaveBeenLastCalledWith("github", {
      repositories: [
        "acme-corp/core",
        "acme-corp/web",
        "acme-corp/api",
      ],
      repositoryOrder: [
        "acme-corp/core",
        "acme-corp/web",
        "acme-corp/api",
      ],
    });

    click(host, '[data-remove-repository="acme-corp/core"]');
    expect(change).toHaveBeenLastCalledWith("github", {
      repositories: ["acme-corp/web", "acme-corp/api"],
      repositoryOrder: ["acme-corp/web", "acme-corp/api"],
    });

    click(host, '[data-add-repository="acme-corp/core"]');
    expect(change).toHaveBeenLastCalledWith("github", {
      repositories: [
        "acme-corp/web",
        "acme-corp/api",
        "acme-corp/core",
      ],
      repositoryOrder: [
        "acme-corp/web",
        "acme-corp/api",
        "acme-corp/core",
      ],
    });
  });

  it("routes disconnected providers to Connections", () => {
    const { host, controller, openConnections } = mount({ connected: false });

    controller.show("github");

    expect(host.querySelector("[data-repository-disconnected]")).not.toBeNull();
    click(host, "[data-open-connections]");
    expect(openConnections).toHaveBeenCalledWith("github");
  });

  it("filters Selected without changing the complete emitted order", () => {
    const { host, controller, change } = mount({
      repositories: [
        "acme-corp/core",
        "acme-corp/web",
        "acme-corp/docs",
      ],
    });
    controller.show("github");
    const search = host.querySelector<HTMLInputElement>(
      "[data-selected-search]",
    )!;

    search.value = "web";
    search.dispatchEvent(new Event("input", { bubbles: true }));

    expect(names(host, "[data-selected-repository]")).toEqual([
      "acme-corp/web",
    ]);
    click(host, '[data-remove-repository="acme-corp/web"]');
    expect(change).toHaveBeenLastCalledWith("github", {
      repositories: ["acme-corp/core", "acme-corp/docs"],
      repositoryOrder: ["acme-corp/core", "acme-corp/docs"],
    });
  });

  it("keeps focus and caret in both repository searches while filtering", async () => {
    const { host, controller } = mount();
    controller.show("github");
    await clickAndFlush(host, "[data-discover-repositories]");

    for (const selector of [
      "[data-selected-search]",
      "[data-available-search]",
    ]) {
      let search = host.querySelector<HTMLInputElement>(selector)!;
      search.focus();
      search.value = "a";
      search.setSelectionRange(1, 1);
      search.dispatchEvent(new Event("input", { bubbles: true }));

      search = host.querySelector<HTMLInputElement>(selector)!;
      expect(document.activeElement).toBe(search);
      expect(search.selectionStart).toBe(1);
    }
  });

  it("keeps selected rows visible across a discovery error and clears it on retry", async () => {
    const discover = vi.fn()
      .mockRejectedValueOnce(new Error("rate limited"))
      .mockResolvedValueOnce([
        { value: "acme-corp/core", label: "core", group: "acme-corp" },
        { value: "acme-corp/api", label: "api", group: "acme-corp" },
      ]);
    const { host, controller } = mount({ discover });
    controller.show("github");

    await clickAndFlush(host, "[data-discover-repositories]");

    expect(host.querySelector("[role=alert]")?.textContent)
      .toContain("rate limited");
    expect(names(host, "[data-selected-repository]")).toEqual([
      "acme-corp/core",
      "acme-corp/web",
    ]);

    await clickAndFlush(host, "[data-discover-repositories]");

    expect(host.querySelector("[role=alert]")).toBeNull();
    expect(names(host, "[data-available-repository]")).toEqual([
      "acme-corp/api",
    ]);
  });

  it("moves repositories with Alt+Arrow and announces the new priority", () => {
    const selected = [
      "acme-corp/core",
      "acme-corp/web",
      "acme-corp/docs",
    ];
    const { host, controller, change } = mount({ repositories: selected });
    controller.show("github");
    const web = host.querySelector<HTMLElement>(
      '[data-selected-repository][data-repository="acme-corp/web"]',
    )!;

    web.focus();
    web.dispatchEvent(new KeyboardEvent("keydown", {
      key: "ArrowUp",
      altKey: true,
      bubbles: true,
    }));

    expect(change).toHaveBeenLastCalledWith("github", {
      repositories: selected,
      repositoryOrder: [
        "acme-corp/web",
        "acme-corp/core",
        "acme-corp/docs",
      ],
    });
    expect(host.querySelector("[data-repository-status]")?.textContent)
      .toContain("acme-corp/web moved to priority 1");
    expect(document.activeElement?.getAttribute("data-repository"))
      .toBe("acme-corp/web");
  });

  it("moves through visible buttons and disables movement past either edge", () => {
    const { host, controller, change } = mount({
      repositories: [
        "acme-corp/core",
        "acme-corp/web",
        "acme-corp/docs",
      ],
    });
    controller.show("github");

    expect(host.querySelector<HTMLButtonElement>(
      '[data-repository-up="acme-corp/core"]',
    )?.disabled).toBe(true);
    expect(host.querySelector<HTMLButtonElement>(
      '[data-repository-down="acme-corp/docs"]',
    )?.disabled).toBe(true);

    click(host, '[data-repository-down="acme-corp/core"]');
    expect(change).toHaveBeenLastCalledWith("github", {
      repositories: [
        "acme-corp/core",
        "acme-corp/web",
        "acme-corp/docs",
      ],
      repositoryOrder: [
        "acme-corp/web",
        "acme-corp/core",
        "acme-corp/docs",
      ],
    });

    click(host, '[data-repository-up="acme-corp/docs"]');
    expect(change).toHaveBeenLastCalledWith("github", {
      repositories: [
        "acme-corp/core",
        "acme-corp/web",
        "acme-corp/docs",
      ],
      repositoryOrder: [
        "acme-corp/web",
        "acme-corp/docs",
        "acme-corp/core",
      ],
    });
  });

  it("routes drag and drop through the same complete-order change", () => {
    const { host, controller, change } = mount({
      repositories: [
        "acme-corp/core",
        "acme-corp/web",
        "acme-corp/docs",
      ],
    });
    controller.show("github");
    host.querySelector<HTMLElement>(
      '[data-repository-drag="acme-corp/docs"]',
    )!.dispatchEvent(new Event("dragstart", { bubbles: true }));
    host.querySelector<HTMLElement>(
      '[data-selected-repository][data-repository="acme-corp/core"]',
    )!.dispatchEvent(new Event("drop", { bubbles: true }));

    expect(change).toHaveBeenLastCalledWith("github", {
      repositories: [
        "acme-corp/core",
        "acme-corp/web",
        "acme-corp/docs",
      ],
      repositoryOrder: [
        "acme-corp/docs",
        "acme-corp/core",
        "acme-corp/web",
      ],
    });
  });

  it("uses labeled sections, a live region, and visible ordering alternatives", () => {
    const { host, controller } = mount({
      repositories: ["acme-corp/core", "acme-corp/web"],
    });
    controller.show("github");

    expect(host.querySelector("h2")?.textContent).toContain(
      "Repository scope",
    );
    expect(host.querySelectorAll("section[aria-labelledby]")).toHaveLength(2);
    expect(host.querySelector("[data-repository-status]")?.getAttribute("role"))
      .toBe("status");
    expect(host.querySelector("[data-repository-up]")).not.toBeNull();
    expect(host.querySelector("[data-repository-down]")).not.toBeNull();
  });
});
