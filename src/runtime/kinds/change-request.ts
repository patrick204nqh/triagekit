// src/runtime/kinds/pull-request.ts
import type { KindManifest } from "../core/manifest";
import type { FieldDef } from "../scoring/field-catalog";
import type { Scorer } from "../scoring/registry";
import { reviewScore } from "../scoring/review";
import { pullRequestRenderer, labelAxis, assigneeAxis } from "../views/review/view";
import { reviewFields } from "./issue";

// PRs share the review fields and add `reviewers` — reviewScore nudges PRs up when
// assignees OR reviewers are present (the reviewSignal +10 branch is PR-only).
export const pullRequestFields: FieldDef[] = [
  ...reviewFields,
  { name: "reviewers", type: "bool" },
];

export const pullRequestKind: KindManifest = {
  kind: "pull-request",
  domain: "work-items",
  fields: pullRequestFields,
  builtInScorer: reviewScore as Scorer,
  renderer: pullRequestRenderer,
  filters: [labelAxis, assigneeAxis],
};
