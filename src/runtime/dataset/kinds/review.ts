import type { TriageItem } from "../item";
import type { Tier } from "../../scoring/tier";
import type { Actor, Label, CheckStatus, Permalink, Relation } from "../shared";

export const PULL_REQUEST = "pull-request" as const;
export const ISSUE = "issue" as const;
export type ReviewKind = typeof PULL_REQUEST | typeof ISSUE;
export type ReviewState = "open" | "closed" | "merged" | "draft";

export interface ReviewDetails {
  number: number;
  state: ReviewState;
  body: string;
  author: Actor;
  assignees: Actor[];
  reviewers: Actor[];          // PR only; empty for issues
  comments: number;
  labels: Label[];
  checks: CheckStatus | null;  // PR only; null for issues
  permalinks: Permalink[];
  relations: Relation[];
}

// A scored review item, as the list/drawer hand it to the card.
export type ReviewItem = TriageItem<ReviewDetails> & { tier: Tier; kind: ReviewKind };

export type MergeMethod = "merge" | "squash" | "rebase";

// Provider-agnostic write surface. GitHub impl lives in ingest/github/actions.ts.
export interface ReviewActions {
  merge(item: ReviewItem, method: MergeMethod): Promise<void>;
  comment(item: ReviewItem, body: string): Promise<void>;
  addLabels(item: ReviewItem, names: string[]): Promise<void>;
  assign(item: ReviewItem, logins: string[]): Promise<void>;
  close(item: ReviewItem): Promise<void>;
}

// "open" is rendered as a plain <a> link and is never dispatched through ReviewActions (no open() method by design).
export type ActionId = "merge" | "comment" | "label" | "assign" | "close" | "open";

// PRs intentionally omit "close" and "assign" from quick actions; those exist on ReviewActions but aren't surfaced for PRs by design.
export function actionsFor(kind: ReviewKind): ActionId[] {
  return kind === PULL_REQUEST
    ? ["merge", "comment", "label", "open"]
    : ["comment", "assign", "close", "label", "open"];
}

export function isBot(a: Actor): boolean { return a.kind === "bot"; }

export function mergeable(d: ReviewDetails): boolean {
  return d.state === "open"
    && d.checks?.state === "pass"
    && !d.checks.conflicts;
}

export function reasonNotMergeable(d: ReviewDetails): string {
  if (d.state === "merged") return "already merged";
  if (d.state === "closed") return "pull request is closed";
  if (d.state === "draft") return "still a draft";
  if (!d.checks) return "no checks reported";
  if (d.checks.conflicts) return "has merge conflicts";
  if (d.checks.state === "fail") return "checks failing";
  if (d.checks.state === "pending") return "checks pending";
  return "";
}
