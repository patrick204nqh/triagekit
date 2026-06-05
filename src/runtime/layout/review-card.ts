import { esc } from "./triage-table";
import {
  type ReviewItem, type ReviewKind, type ActionId, type MergeMethod,
  actionsFor, mergeable, reasonNotMergeable,
} from "../dataset/kinds/review";
import {
  type Sla, tierBadgeHtml, slaTagHtml, actorChipHtml, labelChipHtml,
  checkIndicatorHtml, relationStripHtml,
} from "./atoms";

export interface ReviewCardOpts {
  sla?: Sla;
  collapsed?: boolean;
  defaultMergeMethod?: MergeMethod;
}

export interface CardState {
  armed: ActionId | null;
  busy: boolean;
  error: string;
  method: MergeMethod;
}

const ACTION_LABEL: Record<Exclude<ActionId, "open">, string> = {
  merge: "Merge", comment: "Comment", label: "Label", assign: "Assign", close: "Close",
};

function snippet(body: string): string {
  return esc(body.replace(/\s+/g, " ").trim().slice(0, 160));
}

function selfHref(item: ReviewItem): string {
  return item.details.permalinks.find(p => p.kind === "pr" || p.kind === "issue")?.href ?? item.url;
}

function actionBarHtml(item: ReviewItem, st: CardState): string {
  if (st.busy) {
    return `<button class="act primary" disabled><span class="spin"></span> Working…</button>`;
  }
  if (st.armed === "merge") {
    const opt = (m: MergeMethod) => `<option value="${m}"${m === st.method ? " selected" : ""}>${m}</option>`;
    return `<span class="muted">Merge as</span>
      <select data-method>${opt("squash")}${opt("merge")}${opt("rebase")}</select>
      <button class="act danger" data-confirm>Confirm merge</button>
      <button class="act" data-cancel>Cancel</button>`;
  }
  if (st.armed === "close") {
    return `<button class="act danger" data-confirm>Confirm close</button>
      <button class="act" data-cancel>Cancel</button>`;
  }
  if (st.armed === "comment" || st.armed === "label" || st.armed === "assign") {
    const ph = st.armed === "comment" ? "Write a comment…" : st.armed === "label" ? "label-name" : "github-login";
    const field = st.armed === "comment"
      ? `<textarea class="rc-field" data-input placeholder="${ph}"></textarea>`
      : `<input class="rc-field" data-input placeholder="${ph}">`;
    return `${field}<button class="act primary" data-confirm>${ACTION_LABEL[st.armed]}</button>
      <button class="act" data-cancel>Cancel</button>`;
  }
  const buttons = actionsFor(item.kind as ReviewKind).map(id => {
    if (id === "open") {
      return `<a class="act" data-action="open" href="${esc(selfHref(item))}" target="_blank" rel="noreferrer">Open ↗</a>`;
    }
    if (id === "merge") {
      const ok = mergeable(item.details);
      const attr = ok ? "" : ` disabled title="${esc(reasonNotMergeable(item.details))}"`;
      return `<button class="act primary" data-action="merge"${attr}>Merge</button>`;
    }
    return `<button class="act" data-action="${id}">${ACTION_LABEL[id]}</button>`;
  }).join("");
  const err = st.error ? `<div class="rc-error">✗ ${esc(st.error)}</div>` : "";
  return `${buttons}${err}`;
}

export function reviewCardHtml(
  item: ReviewItem,
  opts: ReviewCardOpts = {},
  state?: Partial<CardState>,
): string {
  const d = item.details;
  const st: CardState = {
    armed: state?.armed ?? null,
    busy: state?.busy ?? false,
    error: state?.error ?? "",
    method: state?.method ?? opts.defaultMergeMethod ?? "squash",
  };
  const sla = opts.sla ? slaTagHtml(opts.sla) : "";
  const head =
    `<div class="rc-head">${tierBadgeHtml(item.tier)}${sla}` +
    `<span class="rc-title">${esc(item.title)}</span>` +
    `<span class="rc-num">#${d.number}</span>` +
    `${relationStripHtml(d.relations, d.permalinks)}</div>`;

  if (opts.collapsed) {
    const avatars = [actorChipHtml(d.author), ...d.reviewers.map(r => actorChipHtml(r))].join("");
    return `<div class="review-card rc-collapsed" data-kind="${esc(item.kind)}" data-state="${d.state}">` +
      `<div class="rc-head">${tierBadgeHtml(item.tier)}` +
      `<span class="rc-title">${esc(item.title)}</span><span class="rc-num">#${d.number}</span>` +
      `${checkIndicatorHtml(d.checks)}<span class="rc-comments">\u{1F4AC} ${d.comments}</span>${avatars}` +
      `<button class="rc-expand" data-action="expand">▾</button></div></div>`;
  }

  const meta =
    `<div class="rc-meta">${actorChipHtml(d.author, "author")}` +
    `${d.assignees.map(a => actorChipHtml(a, "assignee")).join("")}` +
    `${d.reviewers.map(r => actorChipHtml(r, "review")).join("")}` +
    `${checkIndicatorHtml(d.checks)}` +
    `<span class="rc-comments">\u{1F4AC} ${d.comments}</span>` +
    `${d.labels.map(labelChipHtml).join("")}</div>`;

  return `<div class="review-card" data-kind="${esc(item.kind)}" data-state="${d.state}">` +
    `${head}<div class="rc-body">${snippet(d.body)}</div>${meta}` +
    `<div class="rc-actions">${actionBarHtml(item, st)}</div></div>`;
}
