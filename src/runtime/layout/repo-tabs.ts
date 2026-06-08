// src/runtime/layout/repo-tabs.ts
import { esc } from "./triage-table";
import { dismissible, type DismissibleHandle } from "../shell/dismissible";

export interface RepoOption { id: string; label: string; }   // id "" = "All"
export interface RepoTabsProps {
  repos: RepoOption[];
  active: string;            // "" = All
  max?: number;
  onSelect: (id: string) => void;
}

export const MAX_REPO_TABS = 3;

// Tracks the live dismissible handle per host so a re-render can tear it down
// before host.innerHTML replaces the DOM (mirrors toolbar-popover's hoisted
// activeHandle: release/destroy whatever is open before rebuilding). Without
// this, re-rendering while the overflow dropdown is open would orphan the old
// handle's escape-stack entry — a zombie that swallows a later Escape.
const handles = new WeakMap<HTMLElement, DismissibleHandle>();

// Repo view tabs: "All" + up to MAX_REPO_TABS repo tabs inline, the rest behind
// a "+N ▾" overflow dropdown (dismissible via Esc + the more-button toggle). <=1 repo -> nothing.
export function renderRepoTabs(host: HTMLElement, p: RepoTabsProps): void {
  // Tear down any handle from a prior render of this host BEFORE the innerHTML
  // write blows away its DOM, so its escape-stack entry never leaks.
  handles.get(host)?.destroy();
  handles.delete(host);

  if (p.repos.length <= 1) { host.innerHTML = ""; return; }

  const max = p.max ?? MAX_REPO_TABS;
  const inline = p.repos.slice(0, max);
  const overflow = p.repos.slice(max);

  const tab = (id: string, label: string) =>
    `<button class="repo-tab${id === p.active ? " on" : ""}" data-repo="${esc(id)}">${esc(label)}</button>`;

  const moreBtn = overflow.length
    ? `<button class="repo-more" data-repo-more aria-haspopup="true" aria-expanded="false">+${overflow.length} ▾</button>`
    : "";
  const moreMenu = overflow.length
    ? `<div class="repo-pop" data-repo-pop hidden></div>`
    : "";

  host.innerHTML =
    `<div class="repo-tabs">` +
    tab("", "All") +
    inline.map(r => tab(r.id, r.label)).join("") +
    `<div class="repo-ctl">${moreBtn}${moreMenu}</div>` +
    `</div>`;

  // Wire inline tab + "All" selection (delegated over the inline tabs only).
  const wireSelect = (b: HTMLElement) =>
    b.addEventListener("click", () => p.onSelect(b.dataset.repo!));
  host.querySelectorAll<HTMLElement>("[data-repo]").forEach(wireSelect);

  // Overflow dropdown: items are built lazily on first open, then toggled via dismissible.
  if (overflow.length) {
    const moreEl = host.querySelector<HTMLElement>("[data-repo-more]")!;
    const pop = host.querySelector<HTMLElement>("[data-repo-pop]")!;
    let built = false;
    const close = () => {
      pop.hidden = true;
      moreEl.setAttribute("aria-expanded", "false");
      handle.release();
    };
    const handle: DismissibleHandle = dismissible(pop, { onDismiss: close });
    handles.set(host, handle);
    moreEl.addEventListener("click", () => {
      if (pop.hidden) {
        if (!built) {
          pop.innerHTML = overflow.map(r => tab(r.id, r.label)).join("");
          // Selecting a dropdown item fires onSelect, then closes the popover.
          pop.querySelectorAll<HTMLElement>("[data-repo]").forEach(b => {
            wireSelect(b);
            b.addEventListener("click", close);
          });
          built = true;
        }
        pop.hidden = false;
        moreEl.setAttribute("aria-expanded", "true");
        handle.activate();
      } else {
        close();
      }
    });
  }
}
