import { renderMarkdown } from "../markdown";
import type { ReviewItem } from "../../dataset/shapes/review";

// The sanitized GFM Markdown body of a review card.
export function reviewBodyHtml(item: ReviewItem): string {
  return `<div class="rc-body">${renderMarkdown(item.details.body)}</div>`;
}
