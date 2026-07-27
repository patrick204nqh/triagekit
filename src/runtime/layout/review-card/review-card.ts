import {
  type ReviewItem, type ActionId, type MergeMethod,
  CHANGE_REQUEST,
} from "../../dataset/shapes/review";
import {
  type Sla, slaTagHtml, actorChipHtml, labelChipHtml,
  checkIndicatorHtml, relationStripHtml,
} from "../atoms/atoms";
import { reviewBodyHtml } from "./body";
import { actionBarHtml } from "./actions";
import type { DetailView } from "../table/detail-view";
import type { ScoredItem, DetailCtx } from "../table/kind-renderer";

export interface ReviewCardOpts {
  sla?: Sla;
  defaultMergeMethod?: MergeMethod;
}

export interface CardState {
  armed: ActionId | null;
  busy: boolean;
  error: string;
  method: MergeMethod;
}

const STATE_LABEL: Record<string, string> = { open: "Open", merged: "Merged", closed: "Closed", draft: "Draft" };

// A PR whose checks are unfetched (lazy) shows a neutral "open to load" affordance;
// an issue (which never has CI) shows nothing. A fetched CheckStatus renders normally.
function checksHtml(item: ReviewItem): string {
  if (item.kind === CHANGE_REQUEST && item.details.checks === null) {
    return `<span class="check ci-open">checks: open to load</span>`;
  }
  return checkIndicatorHtml(item.details.checks);
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
  const provider = ctx.provider;
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
    if (footHost) {
      footHost.innerHTML = actionBarHtml(
        cur,
        st,
        provider ? (action) => provider.supports(cur.kind, action) : undefined,
      );
    }
  }
  function patch(p: Partial<ReviewItem["details"]>): void {
    Object.assign(cur.details, p);
    ctx.onChange?.(scored);
    renderBody();
  }
  async function run(id: ActionId, payload: string): Promise<void> {
    if (!provider || !provider.supports(cur.kind, id)) return;
    st.busy = true; renderActions();
    try {
      const commandPayload = id === "merge"
        ? { merge_method: st.method }
        : id === "comment"
          ? { body: payload }
          : id === "label"
            ? { labels: [payload] }
            : id === "assign"
              ? { assignees: [payload] }
              : undefined;
      await provider.execute({
        kind: cur.kind,
        ref: cur.providerRef,
        action: id,
        payload: commandPayload,
      });
      if (id === "merge") patch({ state: "merged" });
      else if (id === "close") patch({ state: "closed" });
      else if (id === "comment") patch({ comments: cur.details.comments + 1 });
      else if (id === "label") patch({ labels: [...cur.details.labels, { name: payload, color: "888888" }] });
      else if (id === "assign") patch({ assignees: [...cur.details.assignees, { login: payload, avatarUrl: "", kind: "human" }] });
      st.error = "";
    } catch (e) { st.error = String((e as Error)?.message ?? e); }
    st.busy = false; st.armed = null; renderActions();
  }
  async function expand(): Promise<void> {
    if (enriched || !provider) return;
    enriched = true;
    try {
      const data = (await provider.enrich(
        cur.kind,
        cur.providerRef,
      )) as Partial<ReviewItem["details"]>;
      if (data) { Object.assign(cur.details, data); renderBody(); }
    }
    catch { enriched = false; }
  }

  return {
    header: { title: cur.title, tier: scored.tier, provider: scored.provider, ref: { text: `#${cur.details.number}`, href: selfHref } },
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
