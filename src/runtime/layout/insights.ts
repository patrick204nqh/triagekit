import type { Kind } from "../dataset/item";
import { runtimeCatalog } from "../catalog/built-in";
import type { RuntimeCatalog } from "../catalog/types";
import type { ScoredItem } from "./table/kind-renderer";
import { esc } from "./util";

export function renderInsights(
  root: HTMLElement,
  rows: ScoredItem[],
  kinds: readonly Kind[],
  catalog: RuntimeCatalog = runtimeCatalog,
): void {
  if (!rows.length) { root.innerHTML = `<p class="muted">No items to chart yet — load a view first.</p>`; return; }
  root.innerHTML = `<div class="insights"></div>`;
  const grid = root.querySelector<HTMLElement>(".insights")!;
  for (const c of catalog.chartsFor(kinds)) {
    const card = document.createElement("div");
    card.className = "chart" + (c.span ? " span2" : "");
    const ktag = c.kinds === "*" ? "generic" : c.kinds.join(", ");
    const meta = c.meta?.(rows) ?? "";
    card.innerHTML = `<div class="chart-head"><span class="chart-title">${esc(c.title)}<span class="k">${esc(ktag)}</span></span><span class="chart-meta">${meta}</span></div><div class="chart-body"></div>`;
    c.render(rows, card.querySelector<HTMLElement>(".chart-body")!);
    grid.appendChild(card);
  }
}
