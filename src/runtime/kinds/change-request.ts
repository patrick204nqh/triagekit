// src/runtime/kinds/change-request.ts
import type { KindDeclaration, Scorer } from "../catalog/types";
import type { FieldDef } from "../scoring/field-catalog";
import { reviewScore } from "../scoring/review";
import {
  changeRequestRenderer,
  changeRequestView,
} from "../views/code-review/view";
import { reviewFields } from "./issue";

// Change requests share the review fields and add `reviewers` — reviewScore nudges
// change requests up when assignees OR reviewers are present (the reviewSignal +10
// branch is change-request-only).
export const changeRequestFields: FieldDef[] = [
  ...reviewFields,
  { name: "reviewers", type: "bool" },
];

export const changeRequestKind: KindDeclaration = {
  kind: "change-request",
  domain: "code-review",
  label: "Change requests",
  status: "ready",
  fields: changeRequestFields,
  builtInScorer: reviewScore as Scorer,
  renderer: changeRequestRenderer,
  filters: [],
  sorts: [],
  charts: [],
  views: [changeRequestView],
};
