export function installNativeOverlayDoubles(): void {
  Object.defineProperties(HTMLElement.prototype, {
    showPopover: {
      configurable: true,
      value(this: HTMLElement) {
        this.setAttribute("data-popover-open", "");
        const event = new Event("toggle");
        Object.defineProperty(event, "newState", { value: "open" });
        this.dispatchEvent(event);
      },
    },
    hidePopover: {
      configurable: true,
      value(this: HTMLElement) {
        this.removeAttribute("data-popover-open");
        const event = new Event("toggle");
        Object.defineProperty(event, "newState", { value: "closed" });
        this.dispatchEvent(event);
      },
    },
  });
}
