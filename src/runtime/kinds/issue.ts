// src/runtime/kinds/issue.ts
import type { BuiltInScoreExplainer, KindDeclaration, Scorer } from "../catalog/types";
import type { Tier } from "../scoring/tier";
import type { FieldDef } from "../scoring/field-catalog";
import type { ReviewDetails } from "../dataset/shapes/review";
import { explainReviewScore, reviewScore } from "../scoring/review";
import { issueRenderer, issueView } from "../views/code-review/view";

// Honest detail-level keys on ReviewDetails (dataset/shapes/review.ts) that the
// scorer + filter axes actually read:
//   labels    — labelWeight() in reviewScore + the generic `labels` axis (enum of names)
//   assignees — reviewScore reviewSignal + assigneeAxis       (bool: any assigned)
//   state     — mergeable()/reasonNotMergeable() gate on it   (enum)
//   comments  — engagement signal carried on every item       (number)
export const reviewFields: FieldDef[] = [
  { name: "labels", type: "enum", values: ["security", "vulnerability", "cve", "priority", "urgent", "p0", "p1"] },
  { name: "assignees", type: "bool" },
  { name: "state", type: "enum", values: ["open", "closed", "merged", "draft"] },
  { name: "comments", type: "number", range: [0, 500] },
];

export const issueKind: KindDeclaration = {
  kind: "issue",
  domain: "tracking",
  label: "Issues",
  status: "ready",
  fields: reviewFields,
  builtInScorer: reviewScore as Scorer,
  explainBuiltInScore: explainReviewScore as BuiltInScoreExplainer,
  renderer: issueRenderer,
  filters: [],
  sorts: [],
  charts: [],
  views: [issueView],
  insights: {
    owned: (item) =>
      Boolean((item.details as ReviewDetails | undefined)?.assignees?.length),
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
