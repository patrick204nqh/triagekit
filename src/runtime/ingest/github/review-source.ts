import type { TriageItem } from "../../dataset/item";
import type { Actor, Label, CheckStatus } from "../../dataset/shared";
import {
  type ReviewDetails, type ReviewState, PULL_REQUEST, ISSUE,
} from "../../dataset/kinds/review";
import { type Source, type TriageError, type DiscoveryOption, registerSource } from "../source";
import { ghPaginate, GH_HEADERS } from "./paginate";

// §9 recognized-bot list — complements GitHub's user.type === "Bot". Constant for now;
// a user-configurable list lives with the Policy surface (later slice).
export const KNOWN_BOTS = ["dependabot", "renovate", "github-actions", "snyk"];
export function isBotLogin(login: string): boolean {
  const lower = login.toLowerCase();
  if (lower.endsWith("[bot]")) return true;        // GitHub App accounts: "dependabot[bot]"
  return KNOWN_BOTS.includes(lower);               // bare known-bot logins: "renovate"
}
function toActor(u: any): Actor {
  const login = u?.login ?? "";
  const bot = u?.type === "Bot" || isBotLogin(login);
  return { login, avatarUrl: u?.avatar_url ?? "", kind: bot ? "bot" : "human" };
}
function toLabel(l: any): Label {
  return { name: l?.name ?? "", color: l?.color ?? "888888" };
}

function toReviewItem(full: string, raw: any): TriageItem<ReviewDetails> {
  const isPr = !!raw.pull_request;
  const kind = isPr ? PULL_REQUEST : ISSUE;
  const number = raw.number;
  const state: ReviewState = isPr && raw.draft ? "draft" : "open";
  const labels = (raw.labels ?? []).map(toLabel);
  return {
    id: `github:${full}:${number}`, source: "github", kind,
    title: raw.title ?? "", location: full,
    // cheap cross-source proxy only; the review scorer computes real priority from details.
    signal: Math.min(100, (raw.comments ?? 0) * 4 + labels.length * 12),
    createdAt: raw.created_at ?? "", url: raw.html_url ?? "",
    details: {
      number, state, body: raw.body ?? "", author: toActor(raw.user),
      assignees: (raw.assignees ?? []).map(toActor),
      reviewers: [],                              // filled on enrich for PRs
      comments: raw.comments ?? 0, labels,
      checks: null,                               // lazy — loaded on expand
      permalinks: [{ provider: "github", href: raw.html_url ?? "", kind: isPr ? "pr" : "issue", label: "#" + number }],
      relations: [],                              // full vuln↔PR linking is a later slice
    },
  };
}

async function fetchRepoReviews(full: string, token: string) {
  const out: TriageItem<ReviewDetails>[] = [];
  const [owner, name] = full.split("/");
  // The issues endpoint returns BOTH issues and PRs (a PR carries a `pull_request` field).
  const url = `https://api.github.com/repos/${owner}/${name}/issues?state=open&per_page=100`;
  const res = await ghPaginate(url, GH_HEADERS(token), (page) => {
    for (const raw of page) out.push(toReviewItem(full, raw));
  });
  if (!res.ok) {
    let msg = `${res.status}`;
    try { const j = await res.json(); if (j.message) msg += ` ${j.message}`; } catch { /* ignore */ }
    if (res.status === 403 && res.headers.get("x-github-sso")) msg += " — token not SSO-authorized for org";
    throw new Error(msg);
  }
  return out;
}

function rollupChecks(runs: any[]): CheckStatus["state"] {
  if (!runs.length) return "pending";
  if (runs.some(r => ["failure", "timed_out", "cancelled", "action_required"].includes(r.conclusion))) return "fail";
  if (runs.some(r => r.status !== "completed")) return "pending";
  return "pass";
}

// Lazy enrich (on card expand). PR only: fetch head sha → check-runs, plus mergeable +
// requested reviewers. Issues have no CI, so it is a no-op. Reuses GH_HEADERS.
export async function enrichReview(item: TriageItem<ReviewDetails>, token: string): Promise<Partial<ReviewDetails>> {
  if (item.kind !== PULL_REQUEST) return {};
  const [owner, name] = item.location.split("/");
  const n = item.details.number;
  const headers = GH_HEADERS(token);
  const prRes = await fetch(`https://api.github.com/repos/${owner}/${name}/pulls/${n}`, { headers });
  if (!prRes.ok) return {};
  const pr = await prRes.json();
  const reviewers: Actor[] = (pr.requested_reviewers ?? []).map(toActor);
  const conflicts = pr.mergeable === false || pr.mergeable_state === "dirty";
  let checks: CheckStatus = { state: "pending", conflicts };
  const sha = pr.head?.sha;
  if (sha) {
    const crRes = await fetch(`https://api.github.com/repos/${owner}/${name}/commits/${sha}/check-runs`, { headers });
    if (crRes.ok) {
      const cr = await crRes.json();
      checks = { state: rollupChecks(cr.check_runs ?? []), conflicts };
    }
  }
  return { checks, reviewers };
}

export const githubReviewSource: Source = {
  id: "github-review", provider: "github", domain: "work-items",
  kinds: [PULL_REQUEST, ISSUE],
  connectSrc: ["https://api.github.com"], status: "ready",
  setup: {
    hint: "Use a fine-grained personal access token with read access to pull requests and issues on the repositories you triage (write access to merge/comment/label).",
    url: "https://github.com/settings/personal-access-tokens",
  },
  scopeSchema: [
    { key: "repos", label: "Repositories", type: "multiselect", discoverable: true, required: true },
  ],
  async fetch(scope, token) {
    const repos = (scope.repos as string[]) ?? [];
    const settled = await Promise.allSettled(repos.map(full => fetchRepoReviews(full, token)));
    const items: TriageItem[] = []; const errors: TriageError[] = [];
    settled.forEach((res, i) => res.status === "fulfilled"
      ? items.push(...res.value)
      : errors.push({ target: repos[i], message: String(res.reason?.message ?? res.reason) }));
    return { items, errors };
  },
  async discover(token) {
    const out: DiscoveryOption[] = [];
    const url = "https://api.github.com/user/repos?per_page=100&affiliation=owner,collaborator,organization_member&sort=full_name";
    const res = await ghPaginate(url, GH_HEADERS(token), (page) => {
      for (const r of page) out.push({ value: r.full_name, label: r.name, group: r.owner?.login ?? "" });
    });
    if (!res.ok) { let m = `${res.status}`; try { const j = await res.json(); if (j.message) m += ` ${j.message}`; } catch { /* ignore */ } throw new Error(m); }
    return out;
  },
};
registerSource(githubReviewSource);
