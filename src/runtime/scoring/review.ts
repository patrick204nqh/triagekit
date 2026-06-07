import type { TriageItem } from "../dataset/item";
import { type ReviewDetails, CHANGE_REQUEST } from "../dataset/kinds/review";

// Heuristic review priority, from list-available data only (CI is loaded lazily on
// expand and never feeds the score). Transparent, tunable constants:
//   base            every open item starts here
//   vulnLink (+80)  a `fixes` relation to an alert dominates the queue
//   security (+40)  / priority (+25) / severity-* (+20) labels add weight
//   age (≤30)       older open items rise (staleness), capped at 30
//   reviewSignal(+10) a PR already assigned / under review nudges up
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

function ageWeight(createdAt: string): number {
  const days = (Date.now() - +new Date(createdAt)) / 86400000;
  return Math.min(Math.max(days, 0), 30);
}

export function reviewScore(item: TriageItem<ReviewDetails>): number {
  const d = item.details;
  const vulnLinked = d.relations.some(r => r.type === "fixes");
  let score = 30;
  score += labelWeight(d);
  score += ageWeight(item.createdAt);
  if (vulnLinked) score += 80;
  if (item.kind === CHANGE_REQUEST && (d.assignees.length || d.reviewers.length)) score += 10;
  if (d.author.kind === "bot" && !vulnLinked) score -= 35;
  return Math.round(score);
}
