// Reusable dismiss behaviors for overlay surfaces (the Settings sheet, the detail drawer).
// A surface calls activate() when it becomes visible and release() when it hides; the
// helper wires Escape, optional scrim-click, focus return, and (for modal surfaces) a
// Tab focus-trap plus an inert background. One shared Escape stack guarantees a single
// keypress closes only the topmost open surface.

export interface DismissibleOptions {
  /** Called on Escape (topmost surface only) or scrim click. Hide the surface here. */
  onDismiss: () => void;
  /** Backdrop element whose click dismisses the surface. */
  scrim?: HTMLElement | null;
  /** Return focus to the element that was focused before activate(). Default true. */
  restoreFocus?: boolean;
  /** Modal surfaces trap Tab within the panel and inert everything behind. Default false. */
  modal?: boolean;
  /** Focus target on activate() for modal surfaces. Defaults to the first focusable. */
  initialFocus?: () => HTMLElement | null;
}

export interface DismissibleHandle {
  /** Call when the surface becomes visible. Idempotent. */
  activate(): void;
  /** Call when the surface hides. Idempotent. Restores focus. */
  release(): void;
  /** Remove the surface from the stack and undo any background inert. */
  destroy(): void;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface StackEntry { dismiss(): void; }
const stack: StackEntry[] = [];
let keyBound = false;

function onGlobalKeydown(e: KeyboardEvent): void {
  if (e.key !== "Escape" || stack.length === 0) return;
  e.stopPropagation();
  e.preventDefault();
  stack[stack.length - 1].dismiss();
}

function ensureKeyListener(): void {
  if (keyBound) return;
  document.addEventListener("keydown", onGlobalKeydown, true);
  keyBound = true;
}

function focusables(panel: HTMLElement): HTMLElement[] {
  return [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el => !el.closest("[hidden]"));
}

export function dismissible(panel: HTMLElement, opts: DismissibleOptions): DismissibleHandle {
  const restoreFocus = opts.restoreFocus ?? true;
  const modal = opts.modal ?? false;
  let active = false;
  let trigger: HTMLElement | null = null;

  const dismiss = () => opts.onDismiss();
  const entry: StackEntry = { dismiss };

  function onTrapKeydown(e: KeyboardEvent): void {
    if (e.key !== "Tab") return;
    const f = focusables(panel);
    if (!f.length) { e.preventDefault(); panel.focus?.(); return; }
    const first = f[0];
    const last = f[f.length - 1];
    const a = document.activeElement;
    if (!panel.contains(a)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
  }

  function setBackgroundInert(on: boolean): void {
    for (const el of Array.from(document.body.children)) {
      if (el === panel || el.contains(panel)) continue;
      if (on) el.setAttribute("inert", "");
      else el.removeAttribute("inert");
    }
  }

  return {
    activate() {
      if (active) return;
      active = true;
      trigger = restoreFocus ? (document.activeElement as HTMLElement | null) : null;
      ensureKeyListener();
      stack.push(entry);
      opts.scrim?.addEventListener("click", dismiss);
      if (modal) {
        panel.addEventListener("keydown", onTrapKeydown, true);
        setBackgroundInert(true);
        (opts.initialFocus?.() ?? focusables(panel)[0] ?? panel).focus?.();
      }
    },
    release() {
      if (!active) return;
      active = false;
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      opts.scrim?.removeEventListener("click", dismiss);
      if (modal) {
        panel.removeEventListener("keydown", onTrapKeydown, true);
        setBackgroundInert(false);
      }
      if (restoreFocus && typeof trigger?.focus === "function") trigger.focus();
      trigger = null;
    },
    destroy() {
      this.release();
    },
  };
}
