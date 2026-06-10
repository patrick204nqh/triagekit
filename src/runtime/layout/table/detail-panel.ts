import type { TriageError } from "../../ingest/source";
import type { ScoredItem, DetailCtx } from "./kind-renderer";
import { renderers, warningsHtml } from "./kind-renderer";
import { tableHtml } from "./triage-table";
import { renderScoreBreakdown } from "./score-breakdown";
import { dismissible } from "../../shell/dismissible";
import { esc } from "../util";
import { detailHeadHtml } from "../atoms/atoms";
import type { DetailView } from "./detail-view";

// Fallback detail for kinds without a renderer: identity header + a bare link.
function defaultDetailView(r: ScoredItem): DetailView {
  return {
    header: { title: r.title, tier: r.tier, provider: r.source, ref: undefined },
    body: (host) => {
      host.innerHTML = r.url
        ? `<p><a href="${esc(r.url)}" target="_blank" rel="noreferrer">${esc(r.url)}</a></p>`
        : `<p class="muted">No further detail.</p>`;
    },
  };
}

// Pure layout: render pre-scored rows + non-fatal errors; open a shared right-side
// drawer per row. The drawer is a flex column — non-scrolling header, scrolling
// body, bottom action footer — so footer actions stay visible on long content.
// Each row's kind renderer returns a DetailView the frame mounts into the slots.
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
    + `<aside class="drawer" hidden>
         <div class="drawer-head"><div data-head></div><button class="drawer-close" aria-label="Close">×</button></div>
         <div class="drawer-content" data-body></div>
         <div class="drawer-foot" data-foot></div>
       </aside>`;
  const drawer = root.querySelector<HTMLElement>(".drawer")!;
  const scrim = root.querySelector<HTMLElement>("[data-drawer-scrim]")!;
  const head = drawer.querySelector<HTMLElement>("[data-head]")!;
  const body = drawer.querySelector<HTMLElement>("[data-body]")!;
  const foot = drawer.querySelector<HTMLElement>("[data-foot]")!;

  // The drawer overlays the list; a scrim dims it (and closes on click). Escape also
  // closes, returning focus to the row.
  const dismiss = dismissible(drawer, { onDismiss: () => closeDrawer() });
  function closeDrawer() { drawer.hidden = true; scrim.classList.remove("open"); dismiss.release(); }
  drawer.querySelector<HTMLElement>(".drawer-close")!.addEventListener("click", closeDrawer);
  scrim.addEventListener("click", closeDrawer);

  root.querySelectorAll<HTMLElement>(".alert-row").forEach(tr => {
    tr.addEventListener("click", () => {
      const r = rows[Number(tr.dataset.i)];
      const kr = renderers.get(r.kind);
      const view: DetailView = kr?.detail ? kr.detail(r, ctx) : defaultDetailView(r);
      head.innerHTML = detailHeadHtml(view.header);
      body.innerHTML = "";
      view.body(body);
      if (ctx.scoreExplain) renderScoreBreakdown(body, r, ctx.scoreExplain(r));
      foot.innerHTML = "";
      view.actions?.(foot);
      drawer.hidden = false;
      scrim.classList.add("open");
      dismiss.activate();
    });
  });
}
