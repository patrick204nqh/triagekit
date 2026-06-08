import type { TriageError } from "../../ingest/source";
import type { ScoredItem, DetailCtx } from "./kind-renderer";
import { renderers, warningsHtml } from "./kind-renderer";
import { tableHtml } from "./triage-table";
import { renderScoreBreakdown } from "./score-breakdown";
import { dismissible } from "../../shell/dismissible";
import { esc } from "../util";
import { detailHeaderHtml } from "../atoms/atoms";

function defaultDetail(host: HTMLElement, r: ScoredItem): void {
  host.innerHTML = `<div class="drawer-inner">${detailHeaderHtml({ title: r.title, tier: r.tier, sub: `${r.location} · score ${r.score}` })}
    ${r.url ? `<p><a href="${esc(r.url)}" target="_blank" rel="noreferrer">${esc(r.url)}</a></p>` : ""}</div>`;
}

// Pure layout: render pre-scored rows + non-fatal errors; open a shared right-side
// DetailPanel per row, populated by the row's kind renderer. No fetch/score.
export function renderTriageList(root: HTMLElement, rows: ScoredItem[], errors: TriageError[], ctx: DetailCtx = {}): void {
  const warnings = warningsHtml(errors);
  if (!rows.length) {
    root.innerHTML = warnings + `<div class="empty">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
      <h3>${errors.length ? "No items loaded" : "No open items for these targets"}</h3>
      <p class="muted">${errors.length ? "The targets above returned nothing loadable." : "Everything in scope is clear. Adjust your scope in Settings or load a different provider."}</p>
    </div>`;
    return;
  }
  const r0 = renderers.get(rows[0].kind);
  root.innerHTML = warnings + tableHtml(rows, r0?.columns)
    + `<div class="scrim" data-drawer-scrim></div>`
    + `<aside class="drawer" hidden><div class="drawer-head"><button class="drawer-close" aria-label="Close">×</button></div><div class="drawer-content"></div></aside>`;
  const drawer = root.querySelector<HTMLElement>(".drawer")!;
  const scrim = root.querySelector<HTMLElement>("[data-drawer-scrim]")!;
  const content = drawer.querySelector<HTMLElement>(".drawer-content")!;
  // The drawer overlays the list; a scrim dims it (and closes on click) so the table
  // behind reads as backgrounded rather than awkwardly cropped. Escape also closes,
  // returning focus to the row.
  const dismiss = dismissible(drawer, { onDismiss: () => closeDrawer() });
  function closeDrawer() { drawer.hidden = true; scrim.classList.remove("open"); dismiss.release(); }
  drawer.querySelector<HTMLElement>(".drawer-close")!.addEventListener("click", closeDrawer);
  scrim.addEventListener("click", closeDrawer);
  root.querySelectorAll<HTMLElement>(".alert-row").forEach(tr => {
    tr.addEventListener("click", () => {
      const r = rows[Number(tr.dataset.i)];
      content.innerHTML = "";
      const kr = renderers.get(r.kind);
      if (kr?.detail) kr.detail(content, r, ctx); else defaultDetail(content, r);
      if (ctx.scoreExplain) renderScoreBreakdown(content, r, ctx.scoreExplain(r));
      drawer.hidden = false;
      scrim.classList.add("open");
      dismiss.activate();
    });
  });
}
