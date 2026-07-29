import type { DiscoveryOption } from "../catalog/types";
import {
  moveRepository,
  reconcileRepositoryOrder,
} from "../focus/policy";

export interface RepositoryWorkspaceSnapshot {
  provider: string;
  connected: boolean;
  repositories: readonly string[];
  repositoryOrder: readonly string[];
  discoveryKey: string;
}

export interface RepositoryWorkspaceChange {
  repositories: string[];
  repositoryOrder: string[];
}

export interface RepositorySettingsOptions {
  providers: readonly string[];
  snapshot(provider: string): RepositoryWorkspaceSnapshot;
  discover(provider: string): Promise<readonly DiscoveryOption[]>;
  change(provider: string, next: RepositoryWorkspaceChange): void;
  openConnections(provider: string): void;
}

export interface RepositorySettingsController {
  show(provider: string): void;
  resetView(): void;
}

let workspaceSequence = 0;

function button(label: string, data: Record<string, string>): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.className = "btn-ghost mini";
  element.textContent = label;
  for (const [key, value] of Object.entries(data)) {
    element.dataset[key] = value;
  }
  return element;
}

export function mountRepositorySettings(
  host: HTMLElement,
  options: RepositorySettingsOptions,
): RepositorySettingsController {
  let activeProvider = options.providers[0] ?? "";
  let selectedSearch = "";
  let availableSearch = "";
  const discoveries = new Map<string, readonly DiscoveryOption[]>();
  const discoveryErrors = new Map<string, string>();
  const pendingDiscoveries = new Set<string>();
  let draggedRepository: string | undefined;

  function announce(message: string): void {
    const status = host.querySelector<HTMLElement>("[data-repository-status]");
    if (status) status.textContent = message;
  }

  function focusRepository(repository: string): void {
    [...host.querySelectorAll<HTMLElement>("[data-selected-repository]")]
      .find((row) => row.dataset.repository === repository)
      ?.focus();
  }

  function move(repository: string, targetIndex: number): void {
    const state = options.snapshot(activeProvider);
    const order = reconcileRepositoryOrder(
      state.repositoryOrder,
      state.repositories,
    ).saved;
    const bounded = Math.max(0, Math.min(targetIndex, order.length - 1));
    if (order.indexOf(repository) === bounded) return;
    options.change(activeProvider, {
      repositories: [...state.repositories],
      repositoryOrder: moveRepository(order, repository, bounded),
    });
    render();
    announce(`${repository} moved to priority ${bounded + 1}`);
    focusRepository(repository);
  }

  function render(): void {
    const snapshot = options.snapshot(activeProvider);
    const ordered = reconcileRepositoryOrder(
      snapshot.repositoryOrder,
      snapshot.repositories,
    ).saved;
    const selected = new Set(snapshot.repositories);
    host.replaceChildren();
    const workspace = document.createElement("div");
    workspace.className = "repository-workspace";
    const headingId = `repository-workspace-${++workspaceSequence}`;
    const header = document.createElement("header");
    header.className = "repository-workspace-header";
    const heading = document.createElement("h2");
    heading.id = headingId;
    heading.textContent = "Repository scope";
    const introduction = document.createElement("p");
    introduction.textContent =
      "Choose repositories and set their triage priority.";
    header.append(heading, introduction);
    workspace.setAttribute("aria-labelledby", headingId);
    workspace.append(header);
    host.append(workspace);

    if (options.providers.length > 1) {
      const label = document.createElement("label");
      label.className = "repository-provider";
      label.textContent = "Provider";
      const selector = document.createElement("select");
      selector.className = "repository-provider-select";
      selector.dataset.providerSelect = "";
      for (const provider of options.providers) {
        const option = document.createElement("option");
        option.value = provider;
        option.textContent = provider;
        option.selected = provider === activeProvider;
        selector.append(option);
      }
      selector.addEventListener("change", () => {
        activeProvider = selector.value;
        selectedSearch = "";
        availableSearch = "";
        render();
      });
      label.append(selector);
      header.append(label);
    }

    if (!snapshot.connected) {
      const disconnected = document.createElement("div");
      disconnected.className = "repository-empty";
      disconnected.dataset.repositoryDisconnected = "";
      const copy = document.createElement("p");
      copy.textContent = `${snapshot.provider} is not connected.`;
      const open = button("Open Connections", { openConnections: "" });
      open.addEventListener("click", () => {
        options.openConnections(activeProvider);
      });
      disconnected.append(copy, open);
      workspace.append(disconnected);
      return;
    }

    const selectedHeading = document.createElement("h3");
    selectedHeading.id = `${headingId}-selected`;
    selectedHeading.textContent = "Selected";
    const selectedCount = document.createElement("span");
    selectedCount.className = "repository-count";
    selectedCount.dataset.selectedCount = "";
    selectedCount.textContent = `${snapshot.repositories.length} selected`;
    const selectedFilter = document.createElement("input");
    selectedFilter.type = "search";
    selectedFilter.className = "repository-search";
    selectedFilter.dataset.selectedSearch = "";
    selectedFilter.setAttribute("aria-label", "Search selected repositories");
    selectedFilter.value = selectedSearch;
    selectedFilter.addEventListener("input", () => {
      selectedSearch = selectedFilter.value;
      render();
    });
    const selectedList = document.createElement("div");
    selectedList.className = "repository-list";
    const discovered = discoveries.get(snapshot.discoveryKey);
    const discoveredValues = new Set(
      discovered?.map((option) => option.value) ?? [],
    );
    for (const repository of ordered) {
      if (!selected.has(repository)) continue;
      if (!repository.toLowerCase().includes(selectedSearch.toLowerCase())) {
        continue;
      }
      const row = document.createElement("div");
      row.className = "repository-row selected";
      row.dataset.selectedRepository = "";
      row.dataset.repository = repository;
      row.tabIndex = 0;
      const index = ordered.indexOf(repository);
      row.addEventListener("keydown", (event) => {
        if (!event.altKey) return;
        if (event.key === "ArrowUp") {
          event.preventDefault();
          move(repository, index - 1);
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          move(repository, index + 1);
        }
      });
      row.addEventListener("dragover", (event) => {
        event.preventDefault();
      });
      row.addEventListener("drop", (event) => {
        event.preventDefault();
        if (draggedRepository) move(draggedRepository, index);
        draggedRepository = undefined;
      });
      const name = document.createElement("span");
      name.className = "repository-name";
      name.textContent = repository;
      const drag = button("⋮⋮", { repositoryDrag: repository });
      drag.classList.add("repository-handle");
      drag.setAttribute("aria-label", `Drag ${repository} to reorder`);
      drag.draggable = true;
      drag.addEventListener("dragstart", () => {
        draggedRepository = repository;
      });
      const rank = document.createElement("span");
      rank.className = "repository-rank";
      rank.textContent = String(index + 1);
      const up = button("↑", { repositoryUp: repository });
      up.setAttribute("aria-label", `Move ${repository} up`);
      up.disabled = index === 0;
      up.addEventListener("click", () => {
        move(repository, index - 1);
      });
      const down = button("↓", { repositoryDown: repository });
      down.setAttribute("aria-label", `Move ${repository} down`);
      down.disabled = index === ordered.length - 1;
      down.addEventListener("click", () => {
        move(repository, index + 1);
      });
      row.append(drag, rank, name);
      if (discovered && !discoveredValues.has(repository)) {
        const unavailable = document.createElement("span");
        unavailable.dataset.unavailableSelected = "";
        unavailable.textContent = "Not found in latest scan";
        row.append(unavailable);
      }
      row.append(
        up,
        down,
        button("Remove", { removeRepository: repository }),
      );
      selectedList.append(row);
    }

    const discover = button(
      discoveries.has(snapshot.discoveryKey) ? "Re-scan" : "Scan repositories",
      { discoverRepositories: "" },
    );
    const pending = pendingDiscoveries.has(snapshot.discoveryKey);
    discover.disabled = pending;
    if (pending) discover.textContent = "Scanning…";
    const availableHeading = document.createElement("h3");
    availableHeading.id = `${headingId}-available`;
    availableHeading.textContent = "Available";
    const availableFilter = document.createElement("input");
    availableFilter.type = "search";
    availableFilter.className = "repository-search";
    availableFilter.dataset.availableSearch = "";
    availableFilter.setAttribute("aria-label", "Search available repositories");
    availableFilter.value = availableSearch;
    availableFilter.addEventListener("input", () => {
      availableSearch = availableFilter.value;
      render();
    });
    const availableList = document.createElement("div");
    availableList.className = "repository-list";
    for (const option of discovered ?? []) {
      if (selected.has(option.value)) continue;
      if (!option.value.toLowerCase().includes(availableSearch.toLowerCase())) {
        continue;
      }
      const row = document.createElement("div");
      row.className = "repository-row available";
      row.dataset.availableRepository = "";
      row.dataset.repository = option.value;
      const name = document.createElement("span");
      name.className = "repository-name";
      name.textContent = option.value;
      row.append(
        name,
        button("Add", { addRepository: option.value }),
      );
      availableList.append(row);
    }

    const selectedSection = document.createElement("section");
    selectedSection.className = "repository-section repository-selected";
    selectedSection.setAttribute("aria-labelledby", selectedHeading.id);
    selectedSection.append(
      selectedHeading,
      selectedCount,
      selectedFilter,
      selectedList,
    );
    const availableSection = document.createElement("section");
    availableSection.className = "repository-section repository-available";
    availableSection.setAttribute("aria-labelledby", availableHeading.id);
    availableSection.append(
      availableHeading,
      availableFilter,
      discover,
    );
    const status = document.createElement("p");
    status.className = "repository-status";
    status.dataset.repositoryStatus = "";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    selectedSection.append(status);
    const error = discoveryErrors.get(snapshot.discoveryKey);
    if (error) {
      const alert = document.createElement("p");
      alert.setAttribute("role", "alert");
      alert.dataset.discoveryError = "";
      alert.textContent = error;
      availableSection.append(alert);
    }
    availableSection.append(availableList);
    workspace.append(selectedSection, availableSection);

    discover.addEventListener("click", async () => {
      pendingDiscoveries.add(snapshot.discoveryKey);
      discoveryErrors.delete(snapshot.discoveryKey);
      render();
      try {
        const results = await options.discover(activeProvider);
        discoveries.set(snapshot.discoveryKey, results);
        discoveryErrors.delete(snapshot.discoveryKey);
      } catch (error) {
        discoveryErrors.set(
          snapshot.discoveryKey,
          error instanceof Error ? error.message : String(error),
        );
      } finally {
        pendingDiscoveries.delete(snapshot.discoveryKey);
        render();
      }
    });
    host.querySelectorAll<HTMLButtonElement>("[data-add-repository]")
      .forEach((control) => {
        control.addEventListener("click", () => {
          const repository = control.dataset.addRepository;
          if (!repository) return;
          const current = options.snapshot(activeProvider);
          const order = reconcileRepositoryOrder(
            current.repositoryOrder,
            current.repositories,
          ).saved;
          options.change(activeProvider, {
            repositories: [...current.repositories, repository],
            repositoryOrder: [...order, repository],
          });
          render();
        });
      });
    host.querySelectorAll<HTMLButtonElement>("[data-remove-repository]")
      .forEach((control) => {
        control.addEventListener("click", () => {
          const repository = control.dataset.removeRepository;
          if (!repository) return;
          const current = options.snapshot(activeProvider);
          options.change(activeProvider, {
            repositories: current.repositories.filter(
              (candidate) => candidate !== repository,
            ),
            repositoryOrder: current.repositoryOrder.filter(
              (candidate) => candidate !== repository,
            ),
          });
          render();
        });
      });
  }

  return {
    show(provider) {
      activeProvider = provider;
      render();
    },
    resetView() {
      selectedSearch = "";
      availableSearch = "";
      discoveryErrors.clear();
    },
  };
}
