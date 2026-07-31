import type { ScoredItem, KindRenderer } from "./kind-renderer";
import { esc } from "../util";
import {
  handoffIdentityForItem,
  type HandoffSelection,
} from "../delegation/selection-controls";
import { queueKey } from "../../delegation/queue";

export function tableHtml(
  rows: ScoredItem[],
  extra: KindRenderer["columns"],
  selection?: HandoffSelection,
): string {
  const eh = (extra ?? []).map(c => `<th>${esc(c.header)}</th>`).join("");
  const selectHead = selection
    ? `<th class="queue-col"><span class="sr-only">Handoff queue</span></th>`
    : "";
  const head = `<tr>${selectHead}<th>Location</th><th>Title</th>${eh}<th class="num">Signal</th><th class="num">Score</th><th>Tier</th></tr>`;
  const body = rows.map((r, i) => {
    const ec = (extra ?? []).map(c => `<td>${c.cell(r)}</td>`).join("");
    const selected = selection?.queuedKeys.has(
      queueKey(handoffIdentityForItem(r)),
    ) ?? false;
    const selectCell = selection
      ? `<td class="queue-col"><button type="button" class="queue-row-toggle${selected ? " on" : ""}" data-queue-select data-i="${i}" aria-pressed="${selected}" aria-label="${selected ? "Remove" : "Add"} ${esc(r.title)} ${selected ? "from" : "to"} Handoff queue"><span aria-hidden="true">${selected ? "✓" : "+"}</span></button></td>`
      : "";
    return `<tr class="alert-row" data-i="${i}" tabindex="0" role="button">${selectCell}<td>${esc(r.location)}</td><td>${esc(r.title)}</td>${ec}<td class="num">${r.signal}</td><td class="num">${r.score}</td><td><span class="tier tier-${r.tier}">${r.tier}</span></td></tr>`;
  }).join("");
  return `<table class="alerts"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

// Shimmer placeholder shown while a fetch is in flight (no spinner).
export function renderTableSkeleton(root: HTMLElement): void {
  const rows = Array.from({ length: 8 }).map(() =>
    `<tr><td><div class="sk" style="width:80%"></div></td><td><div class="sk" style="width:60%"></div></td><td><div class="sk" style="width:40%"></div></td><td class="num"><div class="sk" style="width:30%;margin-left:auto"></div></td><td class="num"><div class="sk" style="width:30%;margin-left:auto"></div></td><td><div class="sk" style="width:30%"></div></td></tr>`).join("");
  root.innerHTML = `<table class="alerts"><thead><tr><th>Location</th><th>Title</th><th>Severity</th><th class="num">Signal</th><th class="num">Score</th><th>Tier</th></tr></thead><tbody>${rows}</tbody></table>`;
}
