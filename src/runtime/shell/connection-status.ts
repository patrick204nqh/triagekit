import type {
  DatasetSnapshot,
  RefreshCadence,
} from "../cached-dataset/types";
import { providerIcon } from "./provider-icons";
import { relativeSince } from "./refresh";

export type ConnectionDatasetState =
  | "current"
  | "stale"
  | "memory-only"
  | "not-synced";

export interface ConnectionStatusModel {
  provider: string;
  connected: boolean;
  scopeSummary: string;
  lastFetchedAt: number | null;
  cadence: RefreshCadence;
  datasetState: ConnectionDatasetState;
}

export interface ConnectionStatusOptions {
  openSettings(
    provider: string,
    category: "connections" | "repositories",
  ): void;
}

export interface ConnectionStatusController {
  render(model: ConnectionStatusModel): void;
  updateTime(now?: number): void;
  close(): void;
}

let menuSequence = 0;

export function connectionDatasetState(
  snapshot: DatasetSnapshot | undefined,
): ConnectionDatasetState {
  if (!snapshot || snapshot.phase === "closed") return "not-synced";
  if (snapshot.persistence === "memory") return "memory-only";
  if (
    snapshot.phase === "partial"
    || snapshot.phase === "paused"
    || snapshot.slices.some((slice) => slice.freshness !== "fresh")
  ) {
    return "stale";
  }
  return "current";
}

export function mountConnectionStatus(
  host: HTMLElement,
  options: ConnectionStatusOptions,
): ConnectionStatusController {
  host.classList.add("connection-status-host");
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "status-chip";
  trigger.dataset.connectionStatusTrigger = "";
  trigger.setAttribute("aria-expanded", "false");
  const menuId = `connection-status-menu-${++menuSequence}`;
  trigger.setAttribute("aria-controls", menuId);
  const icon = document.createElement("span");
  icon.innerHTML = providerIcon("unknown", 16);
  const provider = document.createElement("span");
  provider.dataset.statusProvider = "";
  const scope = document.createElement("span");
  scope.dataset.statusScope = "";
  const freshness = document.createElement("span");
  freshness.dataset.statusFreshness = "";
  const chevron = document.createElement("span");
  chevron.className = "connection-status-chevron";
  chevron.setAttribute("aria-hidden", "true");
  chevron.textContent = "⌄";
  trigger.append(icon, provider, scope, freshness, chevron);

  const menu = document.createElement("div");
  menu.id = menuId;
  menu.className = "connection-status-menu";
  menu.dataset.connectionStatusMenu = "";
  menu.hidden = true;
  const heading = document.createElement("div");
  heading.className = "connection-status-heading";
  heading.id = `${menuId}-heading`;
  menu.setAttribute("aria-labelledby", heading.id);
  const menuIcon = document.createElement("span");
  const menuProvider = document.createElement("strong");
  const connection = document.createElement("span");
  connection.dataset.statusConnection = "";
  heading.append(menuIcon, menuProvider, connection);

  const facts = document.createElement("dl");
  const fact = (label: string, data: string) => {
    const row = document.createElement("div");
    row.className = "connection-status-fact";
    const term = document.createElement("dt");
    term.textContent = label;
    const value = document.createElement("dd");
    value.dataset[data] = "";
    row.append(term, value);
    facts.append(row);
    return value;
  };
  const menuScope = fact("Scope", "statusMenuScope");
  const menuUpdated = fact("Last updated", "statusMenuUpdated");
  const menuCadence = fact("Cadence", "statusMenuCadence");
  const menuDataset = fact("Dataset", "statusMenuDataset");
  const actions = document.createElement("div");
  actions.className = "connection-status-actions";
  const connections = document.createElement("button");
  connections.type = "button";
  connections.className = "btn-ghost";
  connections.dataset.statusConnections = "";
  connections.textContent = "Connection settings";
  const repositories = document.createElement("button");
  repositories.type = "button";
  repositories.className = "btn-ghost";
  repositories.dataset.statusRepositories = "";
  repositories.textContent = "Repository settings";
  actions.append(connections, repositories);
  menu.append(heading, facts, actions);
  host.replaceChildren(trigger, menu);

  let current: ConnectionStatusModel | undefined;
  let open = false;

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    const restoreFocus = menu.contains(document.activeElement);
    close();
    if (restoreFocus) trigger.focus();
  };
  const handlePointerdown = (event: Event) => {
    if (event.target instanceof Node && !host.contains(event.target)) close();
  };
  function setOpen(next: boolean): void {
    if (open === next) return;
    open = next;
    menu.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
    if (open) {
      document.addEventListener("keydown", handleKeydown);
      document.addEventListener("pointerdown", handlePointerdown);
    } else {
      document.removeEventListener("keydown", handleKeydown);
      document.removeEventListener("pointerdown", handlePointerdown);
    }
  }
  function close(): void {
    setOpen(false);
  }

  function updateTime(now = Date.now()): void {
    if (!current) return;
    const text = current.lastFetchedAt === null
      ? "not updated"
      : `updated ${relativeSince(current.lastFetchedAt, now)}`;
    freshness.textContent = text;
    menuUpdated.textContent = text;
    trigger.setAttribute(
      "aria-label",
      `${current.provider}, ${current.scopeSummary}, ${text}`,
    );
  }

  trigger.addEventListener("click", () => {
    setOpen(!open);
  });
  connections.addEventListener("click", () => {
    if (!current) return;
    options.openSettings(current.provider, "connections");
    close();
  });
  repositories.addEventListener("click", () => {
    if (!current) return;
    options.openSettings(current.provider, "repositories");
    close();
  });

  return {
    render(model) {
      current = model;
      icon.innerHTML = providerIcon(model.provider, 16);
      menuIcon.innerHTML = providerIcon(model.provider, 18);
      provider.textContent = model.provider;
      menuProvider.textContent = model.provider;
      scope.textContent = model.scopeSummary;
      menuScope.textContent = model.scopeSummary;
      connection.textContent = model.connected ? "Connected" : "Not connected";
      menuCadence.textContent = model.cadence === "off"
        ? "Off"
        : `Every ${model.cadence / 60} minutes`;
      menuDataset.textContent = {
        "current": "Current",
        "stale": "Stale",
        "memory-only": "Memory only",
        "not-synced": "Not synced",
      }[model.datasetState];
      trigger.classList.toggle(
        "ok",
        model.connected && model.datasetState === "current",
      );
      updateTime();
    },
    updateTime,
    close,
  };
}
