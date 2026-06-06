import { type ScoredItem, type KindRenderer, type DetailCtx, registerKindRenderer, esc } from "../../layout/triage-table";
import { mountReviewCard } from "../../layout/review-card";
import type { ReviewItem, ReviewDetails } from "../../dataset/kinds/review";
import { PULL_REQUEST, ISSUE } from "../../dataset/kinds/review";
import { makeGithubActions } from "../../ingest/github/actions";
import { enrichReview } from "../../ingest/github/review-source";   // also pins the source's registerSource() side-effect
import "../../scoring/review";          // side-effect: register PR + issue scorers

const det = (r: ScoredItem) => r.details as ReviewDetails;
const reviewColumns = [
  { header: "#", cell: (r: ScoredItem) => `#${det(r).number}` },
  { header: "Author", cell: (r: ScoredItem) => esc(det(r).author.login) },
];

// Detail = the full, interactive ReviewCard mounted in the shared panel. CI loads
// on mount (review-card fires onExpand when shown non-collapsed).
function detail(host: HTMLElement, r: ScoredItem, ctx: DetailCtx): void {
  const item = r as unknown as ReviewItem;
  mountReviewCard(host, item, {
    actions: ctx.token ? makeGithubActions(ctx.token) : undefined,
    onExpand: ctx.token ? (it) => enrichReview(it, ctx.token!) : undefined,
    onChange: () => ctx.onChange?.(r),
  });
}

for (const kind of [PULL_REQUEST, ISSUE] as const) {
  const renderer: KindRenderer = { kind, columns: reviewColumns, detail };
  registerKindRenderer(renderer);
}
