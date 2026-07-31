import type { TriageFailure } from "../../catalog/types";
import { runtimeCatalog } from "../../catalog/built-in";
import type { RuntimeCatalog } from "../../catalog/types";
import type { ScoredItem, DetailCtx } from "./kind-renderer";
import { warningsHtml } from "./kind-renderer";
import { tableHtml } from "./triage-table";
import { renderScoreBreakdown } from "./score-breakdown";
import { dismissible } from "../../shell/dismissible";
import { esc } from "../util";
import { detailHeadHtml } from "../atoms/atoms";
import type { DetailView } from "./detail-view";
import { queueKey } from "../../handoff/queue";
import { handoffIdentityForItem } from "../handoff/selection-controls";

export interface TriageDetailState {
  readonly activeItemId?: string | null;
  readonly onActiveItemChange?: (itemId: string | null) => void;
}

// Fallback detail for kinds without a renderer: identity header + a bare link.
function defaultDetailView(r: ScoredItem): DetailView {
  return {
    header: { title: r.title, tier: r.tier, provider: r.provider, ref: undefined },
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
export function renderTriageList(
  root: HTMLElement,
  rows: ScoredItem[],
  errors: TriageFailure[],
  ctx: DetailCtx = {},
  catalog: RuntimeCatalog = runtimeCatalog,
  detailState: TriageDetailState = {},
): () => void {
  const failureKind = errors[0]?.kind;
  const surfaceLabel = failureKind
    ? catalog.kind(failureKind)?.label ?? "Data"
    : "Data";
  const warnings = warningsHtml(errors, surfaceLabel);
  if (!rows.length) {
    root.innerHTML = warnings + `<div class="empty">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
      <h3>${errors.length ? "No items loaded" : "No open items for these targets"}</h3>
      <p class="muted">${errors.length ? "The targets above returned nothing loadable." : "Everything in scope is clear. Adjust your scope in Settings or load a different provider."}</p>
    </div>`;
    if (detailState.activeItemId) {
      detailState.onActiveItemChange?.(null);
    }
    return () => {};
  }
  const r0 = catalog.readyKind(rows[0].kind)?.renderer;
  root.innerHTML = warnings + tableHtml(
    rows,
    r0?.columns,
    ctx.handoffSelection,
  )
    + `<div class="scrim" data-drawer-scrim></div>`
    + `<aside class="drawer" hidden role="dialog" aria-modal="true" aria-label="Item detail">
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
  function closeDrawer() {
    drawer.hidden = true;
    scrim.classList.remove("open");
    dismiss.release();
    detailState.onActiveItemChange?.(null);
  }
  drawer.querySelector<HTMLElement>(".drawer-close")!.addEventListener("click", closeDrawer);
  scrim.addEventListener("click", closeDrawer);

  root.querySelectorAll<HTMLElement>("[data-queue-select]").forEach((button) => {
    const toggle = (event: Event) => {
      event.stopPropagation();
      const item = rows[Number(button.dataset.i)];
      if (item) ctx.handoffSelection?.onToggle(item);
    };
    button.addEventListener("click", toggle);
    button.addEventListener("keydown", (event) => event.stopPropagation());
  });

  const openRows = new Map<string, () => void>();
  root.querySelectorAll<HTMLElement>(".alert-row").forEach(tr => {
    const r = rows[Number(tr.dataset.i)];
    const openRow = () => {
      const kr = catalog.readyKind(r.kind)?.renderer;
      const view: DetailView = kr?.detail ? kr.detail(r, ctx) : defaultDetailView(r);
      head.innerHTML = detailHeadHtml(view.header);
      body.innerHTML = "";
      view.body(body);
      if (ctx.scoreExplain) renderScoreBreakdown(body, r, ctx.scoreExplain(r));
      foot.innerHTML = "";
      view.actions?.(foot);
      if (ctx.handoffSelection) {
        const selected = ctx.handoffSelection.queuedKeys.has(
          queueKey(handoffIdentityForItem(r)),
        );
        const btn = document.createElement("button");
        btn.className = "act";
        btn.setAttribute("data-detail-handoff-toggle", "");
        btn.textContent = selected
          ? "Remove from handoff"
          : "Add to handoff";
        btn.addEventListener("click", () => {
          ctx.handoffSelection?.onToggle(r);
        });
        foot.appendChild(btn);
      }
      drawer.hidden = false;
      scrim.classList.add("open");
      dismiss.activate();
      detailState.onActiveItemChange?.(r.id);
    };
    openRows.set(r.id, openRow);
    tr.addEventListener("click", openRow);
    tr.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openRow(); }
    });
  });

  if (detailState.activeItemId) {
    const restore = openRows.get(detailState.activeItemId);
    if (restore) {
      restore();
    } else {
      detailState.onActiveItemChange?.(null);
    }
  }

  return () => dismiss.destroy();
}
