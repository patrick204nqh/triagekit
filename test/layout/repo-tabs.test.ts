// @vitest-environment jsdom
import { beforeEach, describe, it, expect, vi } from "vitest";
import { renderRepoTabs } from "../../src/runtime/layout/navigation/repo-tabs";
import { installNativeOverlayDoubles } from "../helpers/native-overlays";

const opt = (id: string) => ({ id, label: id });

describe("renderRepoTabs", () => {
  beforeEach(installNativeOverlayDoubles);

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
    const inlineTabs = [...host.querySelectorAll(".repo-tabs > [data-repo]")]
      .map(t => (t as HTMLElement).dataset.repo);
    expect(inlineTabs).toEqual(["", "a", "b", "c"]);
    const more = host.querySelector<HTMLButtonElement>(".repo-more")!;
    const pop = host.querySelector<HTMLElement>("[data-repo-pop]")!;
    expect(more).not.toBeNull();
    expect(more.textContent).toContain("2"); // +2 remaining
    expect(pop.getAttribute("popover")).toBe("auto");
    expect(more.popoverTargetElement).toBe(pop);
    expect([...pop.querySelectorAll("[data-repo]")].map((button) =>
      (button as HTMLElement).dataset.repo)).toEqual(["d", "e"]);
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
    const pop = host.querySelector<HTMLElement>("[data-repo-pop]")!;
    pop.showPopover();
    (host.querySelector("[data-repo='d']") as HTMLElement).click();
    expect(onSelect).toHaveBeenCalledWith("d");
    expect(pop.hasAttribute("data-popover-open")).toBe(false);
  });

  it("toggles aria-expanded on the more-button as the dropdown opens/closes", () => {
    const host = document.createElement("div");
    renderRepoTabs(host, {
      repos: [opt("a"), opt("b"), opt("c"), opt("d")],
      active: "",
      onSelect: () => {},
    });
    const more = host.querySelector(".repo-more") as HTMLElement;
    const pop = host.querySelector<HTMLElement>("[data-repo-pop]")!;
    expect(more.getAttribute("aria-expanded")).toBe("false");
    pop.showPopover();
    expect(more.getAttribute("aria-expanded")).toBe("true");
    pop.hidePopover();
    expect(more.getAttribute("aria-expanded")).toBe("false");
  });
});
