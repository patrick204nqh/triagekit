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
import type { AgentHandoffV1 } from "../../handoff/types";
import type { HandoffController } from "../../handoff/controller";
import { renderMarkdown } from "../../handoff/markdown";

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

// Switch the same drawer to show the agent brief instead of the item detail.
// The drawer head gets a back button to restore the original detail view.
function showBriefInDrawer(
  handoff: AgentHandoffV1,
  ctrl: HandoffController,
  body: HTMLElement,
  foot: HTMLElement,
): void {
  const head = body.parentElement?.querySelector<HTMLElement>("[data-head]");
  if (!head) return;
  const origHead = head.innerHTML;
  const origBody = body.innerHTML;
  const origFoot = foot.innerHTML;
  const intent = handoff.intent;
  const t = handoff.targets[0];
  const s = handoff.context.session;

  body.innerHTML = "";

  const disclosure = document.createElement("p");
  disclosure.className = "brief-disclosure";
  disclosure.textContent = "This brief contains the selected item's repository context and provider link. It does not contain your GitHub token.";
  body.appendChild(disclosure);

  const og = document.createElement("div");
  og.className = "brief-item";
  og.innerHTML = `<label>Outcome</label><p class="brief-outcome">${esc(intent.outcome)}</p>`;
  body.appendChild(og);

  if (t) {
    const ig = document.createElement("div");
    ig.className = "brief-item";
    let ih = `<label>Target</label><div class="brief-info">`;
    ih += `<span>Kind</span><span>${esc(t.kind)}</span>`;
    ih += `<span>Provider</span><span>${esc(t.provider)}</span>`;
    ih += `<span>Location</span><span>${esc(t.location)}</span>`;
    ih += `<span>Tier</span><span>${t.priority.tier} (score ${t.priority.score}, signal ${t.priority.signal})</span>`;
    if (t.url) ih += `<span>URL</span><span><a href="${esc(t.url)}" target="_blank" rel="noreferrer">${esc(t.url)}</a></span>`;
    ih += `</div>`;
    ig.innerHTML = ih;
    body.appendChild(ig);

    if (t.priority.explanation && t.priority.explanation.length > 0) {
      const eg = document.createElement("div");
      eg.className = "brief-item";
      eg.innerHTML = `<label>Evidence</label><ul class="brief-evidence">${t.priority.explanation.map(e =>
        `<li><strong>${esc(e.label)}</strong> ${esc(String(e.value))}${e.reason ? ` — ${esc(e.reason)}` : ""}</li>`
      ).join("")}</ul>`;
      body.appendChild(eg);
    }
  }

  if (intent.constraints.length > 0) {
    const cg = document.createElement("div");
    cg.className = "brief-item";
    cg.innerHTML = `<label>Constraints</label><ul>${intent.constraints.map(c => `<li>${esc(c)}</li>`).join("")}</ul>`;
    body.appendChild(cg);
  }

  if (intent.verification.length > 0) {
    const vg = document.createElement("div");
    vg.className = "brief-item";
    vg.innerHTML = `<label>Verification</label><ul>${intent.verification.map(v => `<li>${esc(v)}</li>`).join("")}</ul>`;
    body.appendChild(vg);
  }

  const cg = document.createElement("div");
  cg.className = "brief-item";
  let ch = `<label>Context</label><div class="brief-info">`;
  ch += `<span>Kind</span><span>${esc(s.kind)}</span>`;
  ch += `<span>Provider</span><span>${esc(s.provider)}</span>`;
  if (s.repository) ch += `<span>Repository</span><span>${esc(s.repository)}</span>`;
  ch += `</div>`;
  cg.innerHTML = ch;
  body.appendChild(cg);

  const md = renderMarkdown(handoff);
  const mg = document.createElement("div");
  mg.className = "brief-item";
  mg.innerHTML = `<label>Raw Markdown</label><pre class="brief-raw">${esc(md)}</pre>`;
  body.appendChild(mg);

  foot.innerHTML = `<span class="drawer-msg" data-brief-msg></span>
    <button class="btn brief-copy" data-brief-copy>Copy Markdown</button>
    <button class="btn ghost" data-brief-dl-md>Download .md</button>
    <button class="btn ghost" data-brief-dl-json>Download .json</button>`;
  const msg = foot.querySelector<HTMLElement>("[data-brief-msg]")!;

  foot.querySelector("[data-brief-copy]")!.addEventListener("click", async () => {
    const err = await ctrl.copy(handoff);
    msg.textContent = err ? err : "Copied to clipboard";
    setTimeout(() => { if (msg.textContent === "Copied to clipboard" || msg.textContent === err) msg.textContent = ""; }, 2500);
  });
  foot.querySelector("[data-brief-dl-md]")!.addEventListener("click", () => {
    const err = ctrl.downloadMD(handoff);
    if (err) msg.textContent = err;
  });
  foot.querySelector("[data-brief-dl-json]")!.addEventListener("click", () => {
    const err = ctrl.downloadJSON(handoff);
    if (err) msg.textContent = err;
  });

  const back = document.createElement("button");
  back.className = "drawer-back";
  back.setAttribute("aria-label", "Back to detail");
  back.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>`;
  back.addEventListener("click", () => {
    head.innerHTML = origHead;
    body.innerHTML = origBody;
    foot.innerHTML = origFoot;
  });
  head.parentElement?.insertBefore(back, head);
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
): void {
  const warnings = warningsHtml(errors);
  if (!rows.length) {
    root.innerHTML = warnings + `<div class="empty">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
      <h3>${errors.length ? "No items loaded" : "No open items for these targets"}</h3>
      <p class="muted">${errors.length ? "The targets above returned nothing loadable." : "Everything in scope is clear. Adjust your scope in Settings or load a different provider."}</p>
    </div>`;
    return;
  }
  const r0 = catalog.readyKind(rows[0].kind)?.renderer;
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
      const kr = catalog.readyKind(r.kind)?.renderer;
      const view: DetailView = kr?.detail ? kr.detail(r, ctx) : defaultDetailView(r);
      head.innerHTML = detailHeadHtml(view.header);
      body.innerHTML = "";
      view.body(body);
      if (ctx.scoreExplain) renderScoreBreakdown(body, r, ctx.scoreExplain(r));
      foot.innerHTML = "";
      view.actions?.(foot);
      if (ctx.handoffController) {
        const btn = document.createElement("button");
        btn.className = "btn ghost";
        btn.textContent = "Generate brief";
        btn.addEventListener("click", () => {
          const handoff = ctx.handoffController!.generateFor(r);
          showBriefInDrawer(handoff, ctx.handoffController!, body, foot);
        });
        foot.appendChild(btn);
      }
      drawer.hidden = false;
      scrim.classList.add("open");
      dismiss.activate();
    });
  });
}
