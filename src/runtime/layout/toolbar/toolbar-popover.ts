export function wirePopovers(host: HTMLElement): void {
  for (const which of ["filter", "sort"] as const) {
    const button = host.querySelector<HTMLButtonElement>(`[data-tb-${which}]`)!;
    const popover = host.querySelector<HTMLElement>(`[data-pop="${which}"]`)!;
    popover.setAttribute("popover", "auto");
    button.popoverTargetElement = popover;
    button.setAttribute("aria-expanded", "false");
    popover.addEventListener("toggle", (event) => {
      button.setAttribute(
        "aria-expanded",
        String((event as ToggleEvent).newState === "open"),
      );
    });
  }
}
