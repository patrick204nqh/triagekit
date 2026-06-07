// src/runtime/kinds/change-request.ts
import type { KindManifest } from "../core/manifest";
import type { FieldDef } from "../scoring/field-catalog";
import type { Scorer } from "../scoring/registry";
import { reviewScore } from "../scoring/review";
import { changeRequestRenderer, labelAxis, assigneeAxis } from "../views/review/view";
import { reviewFields } from "./issue";

// Change requests share the review fields and add `reviewers` — reviewScore nudges
// change requests up when assignees OR reviewers are present (the reviewSignal +10
// branch is change-request-only).
export const changeRequestFields: FieldDef[] = [
  ...reviewFields,
  { name: "reviewers", type: "bool" },
];

export const changeRequestKind: KindManifest = {
  kind: "change-request",
  domain: "code-review",
  fields: changeRequestFields,
  builtInScorer: reviewScore as Scorer,
  renderer: changeRequestRenderer,
  filters: [labelAxis, assigneeAxis],
};
