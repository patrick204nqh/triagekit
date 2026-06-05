import type { Kind } from "../dataset/item";
import type { ScoredItem } from "./triage-table";
import { chartsFor } from "./charts/registry";
import { esc } from "./triage-table";
import "./charts/generic";   // register generic charts (side-effect)

export function renderInsights(root: HTMLElement, rows: ScoredItem[], kinds: Kind[]): void {
  if (!rows.length) { root.innerHTML = `<p class="muted">No items to chart yet — load a view first.</p>`; return; }
  root.innerHTML = `<div class="insights"></div>`;
  const grid = root.querySelector<HTMLElement>(".insights")!;
  for (const c of chartsFor(kinds)) {
    const card = document.createElement("div");
    card.className = "chart" + (c.span ? " span2" : "");
    const ktag = c.kinds === "*" ? "generic" : (c.kinds as Kind[]).join(", ");
    const meta = c.meta?.(rows) ?? "";
    card.innerHTML = `<div class="chart-head"><span class="chart-title">${esc(c.title)}<span class="k">${esc(ktag)}</span></span><span class="chart-meta">${meta}</span></div><div class="chart-body"></div>`;
    c.render(rows, card.querySelector<HTMLElement>(".chart-body")!);
    grid.appendChild(card);
  }
}
