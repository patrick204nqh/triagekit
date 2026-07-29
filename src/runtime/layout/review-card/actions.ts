import { esc } from "../util";
import {
  type ReviewItem, type ActionId, type MergeMethod,
  actionsFor, mergeable, reasonNotMergeable,
} from "../../dataset/shapes/review";
import type { CardState } from "./review-card";   // type-only — erased at compile time, no runtime cycle
import type { ActionAvailability } from "../../actions/types";

const ACTION_LABEL: Record<Exclude<ActionId, "open">, string> = {
  merge: "Merge", comment: "Comment", label: "Label", assign: "Assign", close: "Close",
};

function selfHref(item: ReviewItem): string {
  return item.details.permalinks.find(p => p.kind === "pr" || p.kind === "issue")?.href ?? item.url;
}

export function actionBarHtml(
  item: ReviewItem,
  st: CardState,
  availability: readonly ActionAvailability[] = [],
  status: { paused: boolean; retryAt?: number } = { paused: false },
): string {
  if (st.busy) {
    return `<button class="act primary" disabled><span class="spin"></span> Working…</button>`;
  }
  if (st.armed === "merge") {
    const advertised = availability
      .find(({ intent }) => intent === "merge")
      ?.variants
      ?.filter((variant): variant is MergeMethod =>
        variant === "merge" || variant === "squash" || variant === "rebase")
      ?? [];
    const methods = advertised.length > 0 ? advertised : [st.method];
    const opt = (m: MergeMethod) => `<option value="${m}"${m === st.method ? " selected" : ""}>${m}</option>`;
    return `<span class="muted">Merge as</span>
      <select data-method>${methods.map(opt).join("")}</select>
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
  const advertised = new Set(availability.map(({ intent }) => intent));
  const disabled = status.paused ? " disabled" : "";
  const buttons = actionsFor(item.kind)
    .filter((id) => id === "open" || advertised.has(id))
    .map(id => {
    if (id === "open") {
      return `<a class="act" data-action="open" href="${esc(selfHref(item))}" target="_blank" rel="noreferrer">Open ↗</a>`;
    }
    if (id === "merge") {
      const ok = mergeable(item.details);
      const attr = ok ? "" : ` disabled title="${esc(reasonNotMergeable(item.details))}"`;
      return `<button class="act primary" data-action="merge"${attr}${disabled}>Merge</button>`;
    }
    return `<button class="act" data-action="${id}"${disabled}>${ACTION_LABEL[id]}</button>`;
    }).join("");
  const err = st.error ? `<div class="rc-error">✗ ${esc(st.error)}</div>` : "";
  const pause = status.paused
    ? `<div class="rc-error">Paused until <time datetime="${
      status.retryAt ? new Date(status.retryAt).toISOString() : ""
    }">${
      status.retryAt ? esc(new Date(status.retryAt).toLocaleString()) : "provider resumes"
    }</time></div>`
    : "";
  return `${buttons}${pause}${err}`;
}
