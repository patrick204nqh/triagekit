import { esc } from "../util";
import {
  type ReviewItem, type ActionId, type MergeMethod, type ReviewActions,
  CHANGE_REQUEST,
} from "../../dataset/shapes/review";
import {
  type Sla, tierBadgeHtml, slaTagHtml, actorChipHtml, labelChipHtml,
  checkIndicatorHtml, relationStripHtml,
} from "../atoms/atoms";
import { reviewBodyHtml } from "./body";
import { actionBarHtml } from "./actions";
import type { DetailView } from "../table/detail-view";
import type { ScoredItem, DetailCtx } from "../table/kind-renderer";
import { makeGithubActions } from "../../ingest/github/actions";
import { enrichReview } from "../../ingest/github/change-request-source";

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

const STATE_LABEL: Record<string, string> = { open: "Open", merged: "Merged", closed: "Closed", draft: "Draft" };
function stateBadgeHtml(item: ReviewItem): string {
  const s = item.details.state;
  const prov = item.source;
  // Link the #number straight to the PR/issue on the provider (self permalink, else url).
  const href = item.details.permalinks.find(p => p.kind === "pr" || p.kind === "issue")?.href ?? item.url;
  const num = href
    ? `<a class="rc-link" href="${esc(href)}" target="_blank" rel="noreferrer">#${item.details.number}</a>`
    : `#${item.details.number}`;
  return `<span class="rc-state rc-state-${s}">${STATE_LABEL[s] ?? s}</span>`
    + `<span class="rc-prov">${esc(prov)} · ${num}</span>`;
}

// A PR whose checks are unfetched (lazy) shows a neutral "open to load" affordance;
// an issue (which never has CI) shows nothing. A fetched CheckStatus renders normally.
function checksHtml(item: ReviewItem): string {
  if (item.kind === CHANGE_REQUEST && item.details.checks === null) {
    return `<span class="check ci-open">checks: open to load</span>`;
  }
  return checkIndicatorHtml(item.details.checks);
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

  if (opts.collapsed) {
    const avatars = [actorChipHtml(d.author), ...d.reviewers.map(r => actorChipHtml(r))].join("");
    return `<div class="review-card rc-collapsed" data-kind="${esc(item.kind)}" data-state="${d.state}">` +
      `<div class="rc-head">${tierBadgeHtml(item.tier)}` +
      `<span class="rc-title">${esc(item.title)}</span><span class="rc-num">#${d.number}</span>` +
      `${checksHtml(item)}<span class="rc-comments">\u{1F4AC} ${d.comments}</span>${avatars}` +
      `<button class="rc-expand" data-action="expand">▾</button></div></div>`;
  }

  const sla = opts.sla ? slaTagHtml(opts.sla) : "";
  const head =
    `<div class="rc-head">${tierBadgeHtml(item.tier)}${sla}${stateBadgeHtml(item)}` +
    `${relationStripHtml(d.relations, d.permalinks)}</div>` +
    `<div class="rc-title-row"><span class="rc-title">${esc(item.title)}</span></div>`;

  // Byline = the author. Show the name (the role label "author" is redundant in the
  // first byline position); the chip used to render only an avatar, leaving the name
  // reachable solely via the tooltip.
  const byline =
    `<div class="rc-byline">${actorChipHtml(d.author, undefined, { showName: true })}${checksHtml(item)}</div>`;

  const meta =
    `<div class="rc-meta">` +
    `${d.assignees.map(a => actorChipHtml(a, "assignee")).join("")}` +
    `${d.reviewers.map(r => actorChipHtml(r, "review")).join("")}` +
    `<span class="rc-comments">\u{1F4AC} ${d.comments}</span>` +
    `${d.labels.map(labelChipHtml).join("")}</div>`;

  return `<div class="review-card" data-kind="${esc(item.kind)}" data-state="${d.state}">` +
    `${head}${byline}${reviewBodyHtml(item)}${meta}` +
    `<div class="rc-actions">${actionBarHtml(item, st)}</div></div>`;
}

export interface MountOpts extends ReviewCardOpts {
  actions?: ReviewActions;
  onChange?: (item: ReviewItem) => void;
  onExpand?: (item: ReviewItem) => Promise<Partial<ReviewItem["details"]>> | void;
}

export function mountReviewCard(host: HTMLElement, item: ReviewItem, opts: MountOpts = {}): void {
  const cur: ReviewItem = structuredClone(item);
  const st: CardState = {
    armed: null, busy: false, error: "",
    method: opts.defaultMergeMethod ?? "squash",
  };
  let collapsed = opts.collapsed ?? false;
  const { actions } = opts;
  let enriched = false;
  async function expand(): Promise<void> {
    if (enriched || !opts.onExpand) return;
    enriched = true;
    try {
      const patchData = await opts.onExpand(cur);
      if (patchData) patch(patchData);
    } catch {
      enriched = false;   // allow a retry on the next expand
    }
    render();
  }

  function render(): void {
    host.innerHTML = reviewCardHtml(cur, { ...opts, collapsed }, st);
  }

  function patch(p: Partial<ReviewItem["details"]>): void {
    Object.assign(cur.details, p);
    opts.onChange?.(cur);
  }

  async function run(id: ActionId, payload: string): Promise<void> {
    if (!actions) return;
    st.busy = true; render();
    try {
      if (id === "merge") { await actions.merge(cur, st.method); patch({ state: "merged" }); }
      else if (id === "close") { await actions.close(cur); patch({ state: "closed" }); }
      else if (id === "comment") { await actions.comment(cur, payload); patch({ comments: cur.details.comments + 1 }); }
      else if (id === "label") { await actions.addLabels(cur, [payload]); patch({ labels: [...cur.details.labels, { name: payload, color: "888888" }] }); }
      else if (id === "assign") { await actions.assign(cur, [payload]); patch({ assignees: [...cur.details.assignees, { login: payload, avatarUrl: "", kind: "human" }] }); }
      st.error = "";
    } catch (e) {
      st.error = String((e as Error)?.message ?? e);
    }
    st.busy = false; st.armed = null; render();
  }

  host.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t.closest("[data-cancel]")) { st.armed = null; render(); return; }
    if (t.closest("[data-confirm]")) {
      if (!st.armed) return;
      const sel = host.querySelector<HTMLSelectElement>("[data-method]");
      if (sel) st.method = sel.value as MergeMethod;
      const input = host.querySelector<HTMLInputElement | HTMLTextAreaElement>("[data-input]");
      void run(st.armed!, input?.value ?? "");
      return;
    }
    const act = t.closest("[data-action]")?.getAttribute("data-action");
    if (!act) return;
    if (act === "open") return;                       // plain anchor
    if (act === "expand") { collapsed = false; render(); void expand(); return; }
    st.armed = act as ActionId; st.error = ""; render();
  });

  render();
  if (!collapsed && opts.onExpand) void expand();   // non-collapsed (panel) mount: load CI immediately
}

// The review body's top line: dynamic state badge + SLA + "Fixes advisory"
// relation. These live in the body (not the shared header) because they change
// after merge/close and the body re-renders.
function substateHtml(item: ReviewItem, sla?: Sla): string {
  const s = item.details.state;
  const state = `<span class="rc-state rc-state-${s}">${STATE_LABEL[s] ?? s}</span>`;
  const slaTag = sla ? slaTagHtml(sla) : "";
  const rel = relationStripHtml(item.details.relations, item.details.permalinks);
  return `<div class="rc-substate">${state}${slaTag}${rel}</div>`;
}

// The frame-facing detail for review kinds. `body` and `actions` share one
// `cur`/`st` so the card stays interactive across the two DOM regions the
// DetailFrame mounts them into.
export function reviewDetailView(scored: ScoredItem, ctx: DetailCtx, opts: ReviewCardOpts = {}): DetailView {
  const cur: ReviewItem = structuredClone(scored as unknown as ReviewItem);
  const st: CardState = { armed: null, busy: false, error: "", method: opts.defaultMergeMethod ?? "squash" };
  let bodyHost: HTMLElement | null = null;
  let footHost: HTMLElement | null = null;
  let enriched = false;
  const actions = ctx.token ? makeGithubActions(ctx.token) : undefined;
  const selfHref = cur.details.permalinks.find(p => p.kind === "pr" || p.kind === "issue")?.href ?? cur.url;

  function renderBody(): void {
    if (!bodyHost) return;
    const byline = `<div class="rc-byline">${actorChipHtml(cur.details.author, undefined, { showName: true })}${checksHtml(cur)}</div>`;
    const meta = `<div class="rc-meta">`
      + cur.details.assignees.map(a => actorChipHtml(a, "assignee")).join("")
      + cur.details.reviewers.map(r => actorChipHtml(r, "review")).join("")
      + `<span class="rc-comments">\u{1F4AC} ${cur.details.comments}</span>`
      + cur.details.labels.map(labelChipHtml).join("") + `</div>`;
    bodyHost.innerHTML = substateHtml(cur, opts.sla) + byline + reviewBodyHtml(cur) + meta;
  }
  function renderActions(): void {
    if (footHost) footHost.innerHTML = actionBarHtml(cur, st);
  }
  function patch(p: Partial<ReviewItem["details"]>): void {
    Object.assign(cur.details, p);
    ctx.onChange?.(scored);
    renderBody();
  }
  async function run(id: ActionId, payload: string): Promise<void> {
    if (!actions) return;
    st.busy = true; renderActions();
    try {
      if (id === "merge") { await actions.merge(cur, st.method); patch({ state: "merged" }); }
      else if (id === "close") { await actions.close(cur); patch({ state: "closed" }); }
      else if (id === "comment") { await actions.comment(cur, payload); patch({ comments: cur.details.comments + 1 }); }
      else if (id === "label") { await actions.addLabels(cur, [payload]); patch({ labels: [...cur.details.labels, { name: payload, color: "888888" }] }); }
      else if (id === "assign") { await actions.assign(cur, [payload]); patch({ assignees: [...cur.details.assignees, { login: payload, avatarUrl: "", kind: "human" }] }); }
      st.error = "";
    } catch (e) { st.error = String((e as Error)?.message ?? e); }
    st.busy = false; st.armed = null; renderActions();
  }
  async function expand(): Promise<void> {
    if (enriched || !ctx.token) return;
    enriched = true;
    try { const data = await enrichReview(cur, ctx.token); if (data) { Object.assign(cur.details, data); renderBody(); } }
    catch { enriched = false; }
  }

  return {
    header: { title: cur.title, tier: scored.tier, provider: scored.source, ref: { text: `#${cur.details.number}`, href: selfHref } },
    body: (host) => { bodyHost = host; renderBody(); void expand(); },
    actions: (host) => {
      footHost = host; renderActions();
      host.addEventListener("click", (e) => {
        const t = e.target as HTMLElement;
        if (t.closest("[data-cancel]")) { st.armed = null; renderActions(); return; }
        if (t.closest("[data-confirm]")) {
          if (!st.armed) return;
          const sel = host.querySelector<HTMLSelectElement>("[data-method]");
          if (sel) st.method = sel.value as MergeMethod;
          const input = host.querySelector<HTMLInputElement | HTMLTextAreaElement>("[data-input]");
          void run(st.armed, input?.value ?? "");
          return;
        }
        const act = t.closest("[data-action]")?.getAttribute("data-action");
        if (!act || act === "open") return;        // open is a plain anchor
        st.armed = act as ActionId; st.error = ""; renderActions();
      });
    },
  };
}
