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
});
