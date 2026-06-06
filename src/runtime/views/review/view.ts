import { type ScoredItem, warningsHtml } from "../../layout/triage-table";
import type { TriageError } from "../../ingest/source";
import { registerSurface, type SurfaceCtx } from "../../layout/surface";
import { mountReviewCard } from "../../layout/review-card";
import type { ReviewItem } from "../../dataset/kinds/review";
import { makeGithubActions } from "../../ingest/github/actions";
import { enrichReview } from "../../ingest/github/review-source";   // also pins the source's registerSource() side-effect
import "../../scoring/review";          // side-effect: register PR + issue scorers

// Render-only: rows arrive already filtered + sorted by the shell's FacetBar.
// This surface just mounts each row as a collapsed ReviewCard.
export function renderReviewQueue(root: HTMLElement, rows: ScoredItem[], errors: TriageError[], ctx: SurfaceCtx): void {
  // Safe: only mounted for the `review` artifact, whose source emits ReviewDetails
  // items the shell has already scored (score + tier present).
  const items = rows as unknown as ReviewItem[];
  root.innerHTML = warningsHtml(errors) + `<div class="review-list"></div>`;
  const list = root.querySelector<HTMLElement>(".review-list")!;
  if (!items.length) {
    list.innerHTML = `<div class="empty"><h3>No items match</h3><p class="muted">Adjust the facets above.</p></div>`;
    return;
  }
  for (const it of items) {
    const host = document.createElement("div");
    list.appendChild(host);
    mountReviewCard(host, it, {
      collapsed: true,
      actions: makeGithubActions(ctx.token),
      onExpand: (item) => enrichReview(item, ctx.token),
    });
  }
}

registerSurface("review", renderReviewQueue);
