// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderRepoTabs } from "../../src/runtime/layout/navigation/repo-tabs";

const opt = (id: string) => ({ id, label: id });

describe("renderRepoTabs", () => {
  it("renders nothing for <=1 repo", () => {
    const host = document.createElement("div");
    renderRepoTabs(host, { repos: [opt("acme/api")], active: "", onSelect: () => {} });
    expect(host.innerHTML).toBe("");
  });

  it("renders All + up to 3 repo tabs with the active one marked", () => {
    const host = document.createElement("div");
    renderRepoTabs(host, {
      repos: [opt("a"), opt("b"), opt("c")],
      active: "b",
      onSelect: () => {},
    });
    const tabs = [...host.querySelectorAll("[data-repo]")];
    // "All" (data-repo="") + a + b + c = 4 tabs, no overflow
    expect(tabs.map(t => (t as HTMLElement).dataset.repo)).toEqual(["", "a", "b", "c"]);
    const activeTab = host.querySelector("[data-repo='b']")!;
    expect(activeTab.classList.contains("on")).toBe(true);
    expect(host.querySelector(".repo-more")).toBeNull();
  });

  it("shows a +N overflow button when more than max repos", () => {
    const host = document.createElement("div");
    renderRepoTabs(host, {
      repos: [opt("a"), opt("b"), opt("c"), opt("d"), opt("e")],
      active: "",
      onSelect: () => {},
    });
    // All + first 3 (a,b,c) as tabs; d,e go to overflow
    const inlineTabs = [...host.querySelectorAll("[data-repo]")].map(t => (t as HTMLElement).dataset.repo);
    expect(inlineTabs).toEqual(["", "a", "b", "c"]);
    const more = host.querySelector(".repo-more")!;
    expect(more).not.toBeNull();
    expect(more.textContent).toContain("2"); // +2 remaining
  });

  it("fires onSelect with the repo id when a tab is clicked, and '' for All", () => {
    const host = document.createElement("div");
    const onSelect = vi.fn();
    renderRepoTabs(host, { repos: [opt("a"), opt("b")], active: "", onSelect });
    (host.querySelector("[data-repo='a']") as HTMLElement).click();
    expect(onSelect).toHaveBeenCalledWith("a");
    (host.querySelector("[data-repo='']") as HTMLElement).click();
    expect(onSelect).toHaveBeenCalledWith("");
  });

  it("fires onSelect from an overflow dropdown item", () => {
    const host = document.createElement("div");
    const onSelect = vi.fn();
    renderRepoTabs(host, {
      repos: [opt("a"), opt("b"), opt("c"), opt("d")],
      active: "",
      onSelect,
    });
    (host.querySelector(".repo-more") as HTMLElement).click();  // open dropdown
    (host.querySelector("[data-repo='d']") as HTMLElement).click();
    expect(onSelect).toHaveBeenCalledWith("d");
  });

  it("toggles aria-expanded on the more-button as the dropdown opens/closes", () => {
    const host = document.createElement("div");
    renderRepoTabs(host, {
      repos: [opt("a"), opt("b"), opt("c"), opt("d")],
      active: "",
      onSelect: () => {},
    });
    const more = host.querySelector(".repo-more") as HTMLElement;
    expect(more.getAttribute("aria-expanded")).toBe("false");
    more.click(); // open
    expect(more.getAttribute("aria-expanded")).toBe("true");
    more.click(); // close
    expect(more.getAttribute("aria-expanded")).toBe("false");
  });

  it("re-rendering while the overflow dropdown is open tears down the stale handle (no zombie escape entry)", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const repos = [opt("a"), opt("b"), opt("c"), opt("d"), opt("e")];
    renderRepoTabs(host, { repos, active: "", onSelect: () => {} });
    // Open the overflow dropdown -> its dismissible handle is active, one entry on the escape stack.
    (host.querySelector(".repo-more") as HTMLElement).click();
    const oldPop = host.querySelector("[data-repo-pop]") as HTMLElement;
    expect(oldPop.hidden).toBe(false); // confirm it's actually open

    // Re-render the SAME host while the dropdown is open (this is exactly what Task 7 does on every selection).
    renderRepoTabs(host, { repos, active: "a", onSelect: () => {} });
    // oldPop is now detached. With the fix, the old handle was destroy()'d -> escape stack is empty.
    // Without the fix, the old entry is a zombie: this Escape would fire its stale onDismiss and hide oldPop.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(oldPop.hidden).toBe(false); // stale onDismiss did NOT run -> no zombie entry consumed the Escape

    host.remove();
  });

  it("opening the overflow dropdown twice does not duplicate items", () => {
    const host = document.createElement("div");
    renderRepoTabs(host, {
      repos: [opt("a"), opt("b"), opt("c"), opt("d"), opt("e")],
      active: "",
      onSelect: () => {},
    });
    const more = host.querySelector(".repo-more") as HTMLElement;
    more.click();   // open (builds items)
    more.click();   // close
    more.click();   // open again
    const pop = host.querySelector("[data-repo-pop]")!;
    expect([...pop.querySelectorAll("[data-repo]")].map(b => (b as HTMLElement).dataset.repo)).toEqual(["d", "e"]);
  });
});
