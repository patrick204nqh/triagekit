import type { TriageFailure } from "../../catalog/types";
import { runtimeCatalog } from "../../catalog/built-in";
import type { RuntimeCatalog } from "../../catalog/types";
import type { ScoredItem, DetailCtx } from "./kind-renderer";
import { warningsHtml } from "./kind-renderer";
import { tableHtml } from "./triage-table";
import { renderScoreBreakdown } from "./score-breakdown";
import { esc } from "../util";
import { detailHeadHtml } from "../atoms/atoms";
import type { DetailView } from "./detail-view";
import { queueKey } from "../../handoff/queue";
import { handoffIdentityForItem } from "../handoff/selection-controls";

let detailPanelSequence = 0;

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
  const detailTitleId = `item-detail-title-${++detailPanelSequence}`;
  root.innerHTML = warnings + tableHtml(
    rows,
    r0?.columns ?? [],
    ctx.handoffSelection,
  )
    + `<dialog class="drawer" aria-labelledby="${detailTitleId}">
         <div class="drawer-head"><div data-head></div><button class="drawer-close" aria-label="Close" autofocus>×</button></div>
         <div class="drawer-content" data-body></div>
         <div class="drawer-foot" data-foot></div>
       </dialog>`;
  const drawer = root.querySelector<HTMLDialogElement>(".drawer")!;
  const head = drawer.querySelector<HTMLElement>("[data-head]")!;
  const body = drawer.querySelector<HTMLElement>("[data-body]")!;
  const foot = drawer.querySelector<HTMLElement>("[data-foot]")!;

  function closeDrawer() {
    if (drawer.open) drawer.close();
    detailState.onActiveItemChange?.(null);
  }
  drawer.querySelector<HTMLElement>(".drawer-close")!.addEventListener("click", closeDrawer);
  drawer.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDrawer();
  });
  drawer.addEventListener("click", (event) => {
    if (event.target === drawer) closeDrawer();
  });

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
    const detailControl = tr.querySelector<HTMLElement>("[data-open-detail]")!;
    const openRow = () => {
      const kr = catalog.readyKind(r.kind)?.renderer;
      const view: DetailView = kr?.detail ? kr.detail(r, ctx) : defaultDetailView(r);
      head.innerHTML = detailHeadHtml(view.header, detailTitleId);
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
      if (!drawer.open) drawer.showModal();
      detailState.onActiveItemChange?.(r.id);
    };
    openRows.set(r.id, openRow);
    tr.addEventListener("click", openRow);
  });

  if (detailState.activeItemId) {
    const restore = openRows.get(detailState.activeItemId);
    if (restore) {
      restore();
    } else {
      detailState.onActiveItemChange?.(null);
    }
  }

  return () => {
    if (drawer.open) drawer.close();
  };
}
