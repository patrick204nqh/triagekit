import type { Kind, TriageItem } from "../dataset/item";
import type { TriageError } from "../ingest/source";
import type { Tier } from "../scoring/tier";

export interface ScoredItem extends TriageItem { score: number; tier: Tier; }
export interface KindRenderer {
  kind: Kind;
  columns?: { header: string; cell: (i: ScoredItem) => string }[];
  drawer?: (i: ScoredItem) => string;
}
const renderers = new Map<Kind, KindRenderer>();
export function registerKindRenderer(r: KindRenderer) { renderers.set(r.kind, r); }

export function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}
function warningsHtml(errors: TriageError[]): string {
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
function defaultDrawer(r: ScoredItem): string {
  return `<div class="drawer-inner"><h3>${esc(r.title)} <span class="tier tier-${r.tier}">${r.tier}</span></h3>
    <p class="muted">${esc(r.location)} · score ${r.score}</p>
    ${r.url ? `<p><a href="${esc(r.url)}" target="_blank" rel="noreferrer">${esc(r.url)}</a></p>` : ""}
    <button class="drawer-close">Close</button></div>`;
}
// Pure layout: render pre-scored rows + non-fatal errors; wire the drawer. No fetch/score.
export function renderTriageTable(root: HTMLElement, rows: ScoredItem[], errors: TriageError[]): void {
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
  root.innerHTML = warnings + tableHtml(rows, r0?.columns) + `<aside class="drawer" hidden></aside>`;
  const drawer = root.querySelector<HTMLElement>(".drawer")!;
  root.querySelectorAll<HTMLElement>(".alert-row").forEach(tr => {
    tr.addEventListener("click", () => {
      const row = rows[Number(tr.dataset.i)];
      drawer.innerHTML = r0?.drawer?.(row) ?? defaultDrawer(row);
      drawer.hidden = false;
      drawer.querySelector(".drawer-close")?.addEventListener("click", () => { drawer.hidden = true; });
    });
  });
}

// Shimmer placeholder shown while a fetch is in flight (no spinner).
export function renderTableSkeleton(root: HTMLElement): void {
  const rows = Array.from({ length: 8 }).map(() =>
    `<tr><td><div class="sk" style="width:80%"></div></td><td><div class="sk" style="width:60%"></div></td><td><div class="sk" style="width:40%"></div></td><td class="num"><div class="sk" style="width:30%;margin-left:auto"></div></td><td class="num"><div class="sk" style="width:30%;margin-left:auto"></div></td><td><div class="sk" style="width:30%"></div></td></tr>`).join("");
  root.innerHTML = `<table class="alerts"><thead><tr><th>Location</th><th>Title</th><th>Severity</th><th class="num">Signal</th><th class="num">Score</th><th>Tier</th></tr></thead><tbody>${rows}</tbody></table>`;
}
