// CSP forbids inline onerror handlers, so avatar load failures are handled by one
// delegated, capture-phase error listener: it swaps a broken <img.av-img> for the
// initials span carried in data-initials. Idempotent — safe to call once at start.
let installed = false;
export function installAvatarFallback(): void {
  if (installed) return;
  installed = true;
  document.addEventListener("error", (e) => {
    const t = e.target as HTMLElement | null;
    if (!t || t.tagName !== "IMG" || !t.classList.contains("av-img")) return;
    const init = (t as HTMLImageElement).dataset.initials ?? "";
    const span = document.createElement("span");
    span.className = "av" + (t.classList.contains("bot") ? " bot" : "");
    span.textContent = init;
    t.replaceWith(span);
  }, true);   // capture: image error events do not bubble
}
