import { type ScoredItem, esc, warningsHtml } from "../../layout/triage-table";
import type { TriageError } from "../../ingest/source";
import { registerSurface, type SurfaceCtx } from "../../layout/surface";
import { mountReviewCard } from "../../layout/review-card";
import type { ReviewItem } from "../../dataset/kinds/review";
import { makeGithubActions } from "../../ingest/github/actions";
import { enrichReview, githubReviewSource } from "../../ingest/github/review-source";
import "../../scoring/review";          // side-effect: register PR + issue scorers

// keep the registered source referenced so tree-shaking never drops the registration.
void githubReviewSource;

type Facet = "all" | "pull-request" | "issue" | "bot" | "human";
type Sort = "priority" | "recent";

export function renderReviewQueue(root: HTMLElement, rows: ScoredItem[], errors: TriageError[], ctx: SurfaceCtx): void {
  const items = rows as unknown as ReviewItem[];
  const repos = [...new Set(items.map(i => i.location))].sort();
  let facet: Facet = "all";
  let sort: Sort = "priority";
  let repo = "all";

  const visible = (): ReviewItem[] => {
    let v = items.filter(i =>
      facet === "all" ? true
      : facet === "pull-request" ? i.kind === "pull-request"
      : facet === "issue" ? i.kind === "issue"
      : facet === "bot" ? i.details.author.kind === "bot"
      : i.details.author.kind === "human");
    if (repo !== "all") v = v.filter(i => i.location === repo);
    return [...v].sort(sort === "recent"
      ? (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)
      : (a, b) => b.score - a.score);
  };

  const facetBtn = (id: Facet, label: string) =>
    `<button class="rq-chip${facet === id ? " on" : ""}" data-facet="${id}">${label}</button>`;
  const sortBtn = (id: Sort, label: string) =>
    `<button class="rq-chip${sort === id ? " on" : ""}" data-sort="${id}">${label}</button>`;

  const draw = (): void => {
    const v = visible();
    const repoOpts = [`<option value="all">All repos</option>`,
      ...repos.map(r => `<option value="${esc(r)}"${repo === r ? " selected" : ""}>${esc(r)}</option>`)].join("");
    root.innerHTML = warningsHtml(errors) +
      `<div class="review-bar">
        <div class="rq-facets">${facetBtn("all", "All")}${facetBtn("pull-request", "Pull requests")}${facetBtn("issue", "Issues")}${facetBtn("bot", "Bot")}${facetBtn("human", "Human")}</div>
        <select class="rq-repo" aria-label="Filter by repository">${repoOpts}</select>
        <div class="rq-sorts">${sortBtn("priority", "Priority")}${sortBtn("recent", "Recent")}</div>
      </div><div class="review-list"></div>`;

    root.querySelectorAll<HTMLElement>("[data-facet]").forEach(b =>
      b.addEventListener("click", () => { facet = b.dataset.facet as Facet; draw(); }));
    root.querySelectorAll<HTMLElement>("[data-sort]").forEach(b =>
      b.addEventListener("click", () => { sort = b.dataset.sort as Sort; draw(); }));
    root.querySelector<HTMLSelectElement>(".rq-repo")!
      .addEventListener("change", e => { repo = (e.target as HTMLSelectElement).value; draw(); });

    const list = root.querySelector<HTMLElement>(".review-list")!;
    if (!v.length) {
      list.innerHTML = `<div class="empty"><h3>No items match</h3><p class="muted">Adjust the facets above.</p></div>`;
      return;
    }
    for (const it of v) {
      const host = document.createElement("div");
      list.appendChild(host);
      mountReviewCard(host, it, {
        collapsed: true,
        actions: makeGithubActions(ctx.token),
        onExpand: (item) => enrichReview(item, ctx.token),
      });
    }
  };

  draw();
}

registerSurface("review", renderReviewQueue);
