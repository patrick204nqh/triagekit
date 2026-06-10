import { type ScoredItem, type KindRenderer } from "../../layout/table/kind-renderer";
import { esc } from "../../layout/util";
import { reviewDetailView } from "../../layout/review-card/review-card";
import type { ReviewDetails } from "../../dataset/shapes/review";
import { CHANGE_REQUEST, ISSUE } from "../../dataset/shapes/review";
import "../../ingest/github/change-request-source";   // pins the source's registerSource() side-effect
import { type FilterAxis } from "../../layout/toolbar/axis-registry";
import { detailsAs } from "../../dataset/details";
import { uniqueValues } from "../../layout/toolbar/axis-utils";

const det = (r: ScoredItem) => detailsAs<ReviewDetails>(r)!;
const reviewColumns = [
  { header: "#", cell: (r: ScoredItem) => `#${det(r).number}` },
  { header: "Author", cell: (r: ScoredItem) => esc(det(r).author.login) },
];

// Detail = the interactive review DetailView mounted by the DetailFrame. CI loads
// on body-mount. Change requests and issues share columns + detail; they differ
// only by kind tag.
export const changeRequestRenderer: KindRenderer = { kind: CHANGE_REQUEST, columns: reviewColumns, detail: (r, ctx) => reviewDetailView(r, ctx) };
export const issueRenderer: KindRenderer = { kind: ISSUE, columns: reviewColumns, detail: (r, ctx) => reviewDetailView(r, ctx) };

const isReview = (k: string) => k === CHANGE_REQUEST || k === ISSUE;
// NOTE: there is no review-specific "label" axis — the built-in generic `labels` axis
// (axis-registry) already reads `details.labels[].name` via labelNamesOf, which covers
// change-request/issue rows. A second axis here only produced a duplicate "Label" group
// in the Filter popover alongside "Labels".
export const assigneeAxis: FilterAxis = {
  id: "assignee", label: "Assignee", widget: "chips", quick: false,
  appliesTo: (rows) => rows.some(r => isReview(r.kind) && det(r).assignees.length > 0),
  optionsFrom: (rows) => uniqueValues(rows, r => det(r).assignees.map(a => a.login), r => isReview(r.kind)),
  test: (i, sel) => isReview(i.kind) && det(i).assignees.some(a => sel.includes(a.login)),
};
