import { dismissible } from "../shell/dismissible";

// Wires the Filter/Sort popovers' open/close + dismiss (Esc / outside-click).
// A single active handle is hoisted so switching filter<->sort releases whichever
// popover is currently open (the double-Esc fix).
export function wirePopovers(host: HTMLElement): void {
  let activeHandle: ReturnType<typeof dismissible> | null = null;
  let activePop: HTMLElement | null = null;
  for (const which of ["filter", "sort"] as const) {
    const btn = host.querySelector<HTMLElement>(`[data-tb-${which}]`)!;
    const pop = host.querySelector<HTMLElement>(`[data-pop="${which}"]`)!;
    btn.addEventListener("click", () => {
      const opening = pop.hidden;
      if (activePop) activePop.hidden = true;
      if (activeHandle) { activeHandle.release(); activeHandle = null; activePop = null; }
      if (opening) {
        pop.hidden = false;
        activeHandle = dismissible(pop, { onDismiss: () => { pop.hidden = true; activeHandle = null; activePop = null; } });
        activeHandle.activate();
        activePop = pop;
      }
    });
  }
}
