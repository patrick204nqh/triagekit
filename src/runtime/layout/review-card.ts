import { esc } from "./triage-table";
import {
  type ReviewItem, type ActionId, type MergeMethod, type ReviewActions,
  CHANGE_REQUEST,
} from "../dataset/kinds/review";
import {
  type Sla, tierBadgeHtml, slaTagHtml, actorChipHtml, labelChipHtml,
  checkIndicatorHtml, relationStripHtml,
} from "./atoms";
import { reviewBodyHtml } from "./review-card-body";
import { actionBarHtml } from "./review-card-actions";

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
  return `<span class="rc-state rc-state-${s}">${STATE_LABEL[s] ?? s}</span>`
    + `<span class="rc-prov">${esc(prov)} · #${item.details.number}</span>`;
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

  const byline =
    `<div class="rc-byline">${actorChipHtml(d.author, "author")}${checksHtml(item)}</div>`;

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
