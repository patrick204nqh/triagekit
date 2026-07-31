// src/runtime/kinds/change-request.ts
import type { BuiltInScoreExplainer, KindDeclaration, Scorer } from "../catalog/types";
import type { Tier } from "../scoring/tier";
import type { FieldDef } from "../scoring/field-catalog";
import type { ReviewDetails } from "../dataset/shapes/review";
import { explainReviewScore, reviewScore } from "../scoring/review";
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
  explainBuiltInScore: explainReviewScore as BuiltInScoreExplainer,
  renderer: changeRequestRenderer,
  filters: [],
  sorts: [],
  charts: [],
  views: [changeRequestView],
  insights: {
    owned: (item) =>
      Boolean((item.details as ReviewDetails | undefined)?.author?.login),
    evidenced: (item) =>
      Boolean(
        item.title
        && (item.details as ReviewDetails | undefined)?.state,
      ),
  },
  projectTarget: (item) => {
    const d = item.details as ReviewDetails | undefined;
    return {
      title: item.title,
      location: item.location,
      providerReference: { number: d?.number ?? 0, state: d?.state ?? "open" },
      createdAt: item.createdAt,
      priority: { signal: item.signal, score: 0, tier: "P3" as Tier },
      details: { number: d?.number ?? 0, state: d?.state ?? "open", author: d?.author?.login ?? "" },
    };
  },
};
