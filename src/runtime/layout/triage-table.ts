import type { Kind, TriageItem } from "../dataset/item";
import type { TriageError } from "../ingest/source";
import type { Tier } from "../scoring/tier";
import type { ScoreExplanation } from "../scoring/score-model";
import { dismissible } from "../shell/dismissible";
import { esc } from "./util";
export { esc } from "./util";   // back-compat re-export — esc's canonical home is ./util

export interface ScoredItem extends TriageItem { score: number; tier: Tier; }
export interface DetailCtx {
  token?: string;
  onChange?: (i: ScoredItem) => void;
  scoreExplain?: (i: ScoredItem) => ScoreExplanation | null;   // null = built-in path (no per-signal breakdown)
}
export interface KindRenderer {
  kind: Kind;
  columns?: { header: string; cell: (i: ScoredItem) => string }[];
  detail?: (host: HTMLElement, i: ScoredItem, ctx: DetailCtx) => void;
}
const renderers = new Map<Kind, KindRenderer>();
export function registerKindRenderer(r: KindRenderer) { renderers.set(r.kind, r); }

export function warningsHtml(errors: TriageError[]): string {
  if (!errors.length) return "";
  const items = errors.map(e => `<li>${esc(e.target)}: ${esc(e.message)}</li>`).join("");
  const noun = errors.length === 1 ? "target" : "targets";
  return `<div class="warnings"><strong>${errors.length} ${noun} couldn't be loaded</strong><ul>${items}</ul></div>`;
}
function tableHtml(rows: ScoredItem[], extra: KindRenderer["columns"]): string {
  const eh = (extra ?? []).map(c => `<th>${esc(c.header)}</th>`).join("");
  const head = `<tr><th>Location</th><th>Title</th>${eh}<th class="num">Signal</th><th class="num">Score</th><th>Tier</th></tr>`;
  const body = rows.map((r, i) => {
    const ec = (extra ?? []).map(c => `<td>${c.cell(r)}</td>`).join("");
    return `<tr class="alert-row" data-i="${i}"><td>${esc(r.location)}</td><td>${esc(r.title)}</td>${ec}<td class="num">${r.signal}</td><td class="num">${r.score}</td><td><span class="tier tier-${r.tier}">${r.tier}</span></td></tr>`;
  }).join("");
  return `<table class="alerts"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}
// Always-on-where-possible transparency: a per-signal factor table when a configured
// model scored the row, or a compact built-in note otherwise. Appends to `host`.
export function renderScoreBreakdown(host: HTMLElement, item: ScoredItem, explanation: ScoreExplanation | null): void {
  const block = document.createElement("div");
  block.className = "score-detail";
  if (!explanation) {
    block.innerHTML = `<h4>Score</h4>
      <p class="muted">Built-in scorer · score ${item.score} · <span class="tier tier-${item.tier}">${esc(item.tier)}</span></p>
      <p class="muted">Configure scoring in Settings to see the per-factor breakdown.</p>`;
  } else {
    const rows = Object.entries(explanation.signals).map(([name, s]) =>
      `<tr><td>${esc(name)}</td><td class="muted">${esc(s.from)}</td><td>${esc(s.raw)}</td><td class="num">${s.value.toFixed(2)}</td></tr>`).join("");
    block.innerHTML = `<h4>Score breakdown</h4>
      <table class="breakdown"><thead><tr><th>Signal</th><th>Field</th><th>Raw</th><th>0–1</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="bd-total">score <strong>${explanation.score}</strong> → <span class="tier tier-${item.tier}">${esc(item.tier)}</span></p>`;
  }
  host.appendChild(block);
}
function defaultDetail(host: HTMLElement, r: ScoredItem): void {
  host.innerHTML = `<div class="drawer-inner"><h3>${esc(r.title)} <span class="tier tier-${r.tier}">${r.tier}</span></h3>
    <p class="muted">${esc(r.location)} · score ${r.score}</p>
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
    + `<aside class="drawer" hidden><div class="drawer-head"><button class="drawer-close" aria-label="Close">×</button></div><div class="drawer-content"></div></aside>`;
  const drawer = root.querySelector<HTMLElement>(".drawer")!;
  const content = drawer.querySelector<HTMLElement>(".drawer-content")!;
  // Non-modal inspector: Escape closes it and focus returns to the row, but the list
  // behind stays interactive (no scrim, no focus-trap).
  const dismiss = dismissible(drawer, { onDismiss: () => closeDrawer() });
  function closeDrawer() { drawer.hidden = true; dismiss.release(); }
  drawer.querySelector<HTMLElement>(".drawer-close")!.addEventListener("click", closeDrawer);
  root.querySelectorAll<HTMLElement>(".alert-row").forEach(tr => {
    tr.addEventListener("click", () => {
      const r = rows[Number(tr.dataset.i)];
      content.innerHTML = "";
      const kr = renderers.get(r.kind);
      if (kr?.detail) kr.detail(content, r, ctx); else defaultDetail(content, r);
      if (ctx.scoreExplain) renderScoreBreakdown(content, r, ctx.scoreExplain(r));
      drawer.hidden = false;
      dismiss.activate();
    });
  });
}

// Shimmer placeholder shown while a fetch is in flight (no spinner).
export function renderTableSkeleton(root: HTMLElement): void {
  const rows = Array.from({ length: 8 }).map(() =>
    `<tr><td><div class="sk" style="width:80%"></div></td><td><div class="sk" style="width:60%"></div></td><td><div class="sk" style="width:40%"></div></td><td class="num"><div class="sk" style="width:30%;margin-left:auto"></div></td><td class="num"><div class="sk" style="width:30%;margin-left:auto"></div></td><td><div class="sk" style="width:30%"></div></td></tr>`).join("");
  root.innerHTML = `<table class="alerts"><thead><tr><th>Location</th><th>Title</th><th>Severity</th><th class="num">Signal</th><th class="num">Score</th><th>Tier</th></tr></thead><tbody>${rows}</tbody></table>`;
}
