import type { ScoredItem, TableColumn } from "./kind-renderer";
import { esc } from "../util";
import {
  handoffIdentityForItem,
  type HandoffSelection,
} from "../handoff/selection-controls";
import { queueKey } from "../../handoff/queue";

const tableRegion = (label: string, table: string): string =>
  `<div class="table-scroll" role="region" aria-label="${label}" tabindex="0">${table}</div>`;

export function tableHtml(
  rows: ScoredItem[],
  columns: readonly TableColumn[],
  selection?: HandoffSelection,
): string {
  const headCells = columns.map((column) =>
    `<th${column.className ? ` class="${esc(column.className)}"` : ""}>${esc(column.header)}</th>`).join("");
  const selectHead = selection
    ? `<th class="queue-col"><span class="sr-only">Handoff queue</span></th>`
    : "";
  const head = `<tr>${selectHead}${headCells}</tr>`;
  const body = rows.map((r, i) => {
    const cells = columns.map((column) =>
      `<td${column.className ? ` class="${esc(column.className)}"` : ""}>${column.cell(r)}</td>`).join("");
    const selected = selection?.queuedKeys.has(
      queueKey(handoffIdentityForItem(r)),
    ) ?? false;
    const selectCell = selection
      ? `<td class="queue-col"><button type="button" class="queue-row-toggle${selected ? " on" : ""}" data-queue-select data-i="${i}" aria-pressed="${selected}" aria-label="${selected ? "Remove" : "Add"} ${esc(r.title)} ${selected ? "from" : "to"} Handoff queue"><span aria-hidden="true">${selected ? "✓" : "+"}</span></button></td>`
      : "";
    return `<tr class="alert-row" data-i="${i}">${selectCell}${cells}</tr>`;
  }).join("");
  return tableRegion(
    "Triage items",
    `<table class="alerts"><thead>${head}</thead><tbody>${body}</tbody></table>`,
  );
}

// Shimmer placeholder shown while a fetch is in flight (no spinner).
const neutralSkeletonColumns: readonly TableColumn[] = [
  "Repository",
  "Title",
  "State",
  "Priority",
].map((header) => ({ header, cell: () => "" }));

export function renderTableSkeleton(
  root: HTMLElement,
  columns: readonly TableColumn[] = neutralSkeletonColumns,
): void {
  const rows = Array.from({ length: 8 }).map(() =>
    `<tr>${columns.map((column, index) =>
      `<td${column.className ? ` class="${esc(column.className)}"` : ""}><div class="sk" style="width:${index < 2 ? "70%" : "40%"}"></div></td>`).join("")}</tr>`).join("");
  root.innerHTML = tableRegion(
    "Loading triage items",
    `<table class="alerts"><thead><tr>${columns.map((column) =>
      `<th${column.className ? ` class="${esc(column.className)}"` : ""}>${esc(column.header)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>`,
  );
}
