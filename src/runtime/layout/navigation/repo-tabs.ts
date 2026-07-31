import { esc } from "../util";

export interface RepoOption { id: string; label: string; }   // id "" = "All"
export interface RepoTabsProps {
  repos: RepoOption[];
  active: string;            // "" = All
  max?: number;
  onSelect: (id: string) => void;
}

export const MAX_REPO_TABS = 3;

export function renderRepoTabs(host: HTMLElement, p: RepoTabsProps): void {
  if (p.repos.length <= 1) { host.innerHTML = ""; return; }

  const max = p.max ?? MAX_REPO_TABS;
  const inline = p.repos.slice(0, max);
  const overflow = p.repos.slice(max);
  const tab = (id: string, label: string) =>
    `<button class="repo-tab${id === p.active ? " on" : ""}" data-repo="${esc(id)}">${esc(label)}</button>`;
  const more = overflow.length
    ? `<div class="repo-ctl">
      <button class="repo-more" data-repo-more aria-haspopup="true" aria-expanded="false">+${overflow.length} ▾</button>
      <div class="repo-pop" data-repo-pop>${overflow.map((repo) => tab(repo.id, repo.label)).join("")}</div>
    </div>`
    : "";

  host.innerHTML = `<div class="repo-tabs">
    ${tab("", "All")}${inline.map((repo) => tab(repo.id, repo.label)).join("")}${more}
  </div>`;

  host.querySelectorAll<HTMLElement>("[data-repo]").forEach((button) =>
    button.addEventListener("click", () => p.onSelect(button.dataset.repo!)));

  if (!overflow.length) return;
  const button = host.querySelector<HTMLButtonElement>("[data-repo-more]")!;
  const popover = host.querySelector<HTMLElement>("[data-repo-pop]")!;
  popover.setAttribute("popover", "auto");
  button.popoverTargetElement = popover;
  popover.addEventListener("toggle", (event) => {
    button.setAttribute(
      "aria-expanded",
      String((event as ToggleEvent).newState === "open"),
    );
  });
  popover.querySelectorAll<HTMLElement>("[data-repo]").forEach((item) =>
    item.addEventListener("click", () => popover.hidePopover()));
}
