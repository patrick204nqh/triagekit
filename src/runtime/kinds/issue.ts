// src/runtime/kinds/issue.ts
import type { KindManifest } from "../core/manifest";
import type { FieldDef } from "../scoring/field-catalog";
import type { Scorer } from "../scoring/registry";
import { reviewScore } from "../scoring/review";
import { issueRenderer, assigneeAxis } from "../views/code-review/view";

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

export const issueKind: KindManifest = {
  kind: "issue",
  domain: "tracking",
  fields: reviewFields,
  builtInScorer: reviewScore as Scorer,
  renderer: issueRenderer,
  filters: [assigneeAxis],
};
