import type { TriageItem } from "../dataset/item";
import { type ReviewDetails, CHANGE_REQUEST } from "../dataset/shapes/review";
import type { BuiltInScoreFactor, ScoreExplanation } from "./score-model";

// Heuristic review priority, from list-available data only (CI is loaded lazily on
// expand and never feeds the score). Transparent, tunable constants:
//   base            every open item starts here
//   vulnLink (+80)  a `fixes` relation to an alert dominates the queue
//   security (+40)  / priority (+25) / severity-* (+20) labels add weight
//   age (≤30)       older open items rise (staleness), capped at 30
//   reviewSignal(+10) a change request already assigned / under review nudges up
//   botDamp (-35)   bot-authored items are damped unless vuln-linked
const SECURITY_LABELS = ["security", "vulnerability", "cve"];
const PRIORITY_LABELS = ["priority", "urgent", "p0", "p1"];

function labelWeight(d: ReviewDetails): number {
  let w = 0;
  for (const l of d.labels) {
    const n = l.name.toLowerCase();
    if (SECURITY_LABELS.some(s => n.includes(s))) w += 40;
    if (PRIORITY_LABELS.some(s => n.includes(s))) w += 25;
    if (n.startsWith("severity")) w += 20;
  }
  return w;
}

function calculate(item: TriageItem<ReviewDetails>, now: number) {
  const d = item.details;
  const vulnLinked = d.relations.some(r => r.type === "fixes");
  const hasReviewActivity = item.kind === CHANGE_REQUEST
    && Boolean(d.assignees.length || d.reviewers.length);
  const botDampened = d.author.kind === "bot" && !vulnLinked;
  const factors: BuiltInScoreFactor[] = [
    { label: "Base", raw: null, contribution: 30, reason: "open work" },
    { label: "Labels", raw: d.labels.map((label) => label.name).join(", "), contribution: labelWeight(d), reason: "priority labels" },
    { label: "Vulnerability", raw: vulnLinked, contribution: vulnLinked ? 80 : 0, reason: vulnLinked ? "fixes a vulnerability" : "no vulnerability link" },
    { label: "Review activity", raw: hasReviewActivity, contribution: hasReviewActivity ? 10 : 0, reason: hasReviewActivity ? "review underway" : "no review activity" },
    { label: "Author", raw: d.author.kind, contribution: botDampened ? -35 : 0, reason: botDampened ? "bot dampening" : "no bot dampening" },
  ];
  const subtotal = factors.reduce((total, factor) => total + factor.contribution, 0);
  const ageDays = Math.min(Math.max((now - +new Date(item.createdAt)) / 86400000, 0), 30);
  const score = Math.round(subtotal + ageDays);
  factors.push({
    label: "Age",
    raw: Math.round(ageDays),
    contribution: score - subtotal,
    reason: `${Math.round(ageDays)} days open`,
  });
  return { score, factors };
}

export function reviewScore(
  item: TriageItem<ReviewDetails>,
  now = Date.now(),
): number {
  return calculate(item, now).score;
}

export function explainReviewScore(
  item: TriageItem<ReviewDetails>,
  now: number,
): Extract<ScoreExplanation, { source: "built-in" }> {
  return { source: "built-in", ...calculate(item, now) };
}
