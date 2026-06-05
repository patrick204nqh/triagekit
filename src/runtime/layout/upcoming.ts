import type { Source } from "../ingest/source";
import { esc } from "./triage-table";

export function renderUpcoming(root: HTMLElement, source: Source): void {
  const kinds = source.kinds.map(k => `<li>${esc(k)}</li>`).join("");
  root.innerHTML = `<div class="upcoming">
    <h2>${esc(source.id)} <span class="badge">upcoming</span></h2>
    <p class="muted">This source is on the roadmap. It will triage:</p>
    <ul>${kinds}</ul></div>`;
}
