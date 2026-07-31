const dialogTriggers = new WeakMap<HTMLDialogElement, HTMLElement>();

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
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        if (document.activeElement instanceof HTMLElement) {
          dialogTriggers.set(this, document.activeElement);
        }
        this.setAttribute("open", "");
        this.querySelector<HTMLElement>("[autofocus]")?.focus();
      },
    },
    close: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute("open");
        this.dispatchEvent(new Event("close"));
        dialogTriggers.get(this)?.focus();
        dialogTriggers.delete(this);
      },
    },
  });
}
