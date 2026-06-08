import type { ScoredItem } from "./table/kind-renderer";
import { esc } from "./util";
import { registerTab } from "./tab-registry";
import { deadlineOf } from "../dataset/details";

export function dueSoonRows(rows: ScoredItem[]): ScoredItem[] {
  return rows
    .filter(r => deadlineOf(r) != null)
    .sort((a, b) => +new Date(deadlineOf(a)!) - +new Date(deadlineOf(b)!));
}

export function renderDueSoon(root: HTMLElement, rows: ScoredItem[]): void {
  const due = dueSoonRows(rows);
  if (!due.length) {
    root.innerHTML = `<div class="empty"><h3>Nothing due</h3>
      <p class="muted">No items in this view carry a deadline yet.</p></div>`;
    return;
  }
  const body = due.map(r => {
    const when = new Date(deadlineOf(r)!).toISOString().slice(0, 10);
    return `<tr><td>${esc(when)}</td><td>${esc(r.location)}</td><td>${esc(r.title)}</td>
      <td><span class="tier tier-${r.tier}">${r.tier}</span></td></tr>`;
  }).join("");
  root.innerHTML = `<table class="alerts due-soon"><thead>
    <tr><th>Due</th><th>Location</th><th>Title</th><th>Tier</th></tr></thead>
    <tbody>${body}</tbody></table>`;
}

registerTab({
  id: "due-soon",
  label: "Due soon",
  order: 10,
  appliesTo: (_artifact, rows) => rows.some(r => deadlineOf(r) != null),
  render: (root, rows) => renderDueSoon(root, rows),
});
