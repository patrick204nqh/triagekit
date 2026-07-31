import { esc } from "../util";
import type { TableColumn } from "./kind-renderer";

export const repositoryColumn = (): TableColumn => ({
  header: "Repository",
  cell: (item) => esc(item.location),
});

export const titleColumn = (header: string): TableColumn => ({
  header,
  cell: (item) =>
    `<button type="button" class="alert-row-open" data-open-detail>${esc(item.title)}</button>`,
});

export const priorityColumn = (): TableColumn => ({
  header: "Priority",
  className: "priority-col",
  cell: (item) =>
    `<span class="tier tier-${item.tier}">${item.tier}</span><span class="priority-score"> · ${item.score}</span>`,
});
