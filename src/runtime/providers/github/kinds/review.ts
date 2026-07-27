import type { TriageItem } from "../../../dataset/item";
import type { Actor, Label } from "../../../dataset/shared";
import {
  CHANGE_REQUEST,
  ISSUE,
  type ReviewDetails,
  type ReviewState,
} from "../../../dataset/shapes/review";
import { GithubIssue } from "../schemas";
import type { GithubKindIngest } from "../repository-ingest";

const bots = ["dependabot", "renovate", "github-actions", "snyk"];
const actor = (raw: { login?: string; avatar_url?: string; type?: string } | undefined): Actor => {
  const login = raw?.login ?? "unknown";
  return {
    login,
    avatarUrl: raw?.avatar_url ?? "",
    kind: raw?.type === "Bot"
      || login.toLowerCase().endsWith("[bot]")
      || bots.includes(login.toLowerCase()) ? "bot" : "human",
  };
};
const label = (raw: { name?: string; color?: string }): Label => ({
  name: raw?.name ?? "",
  color: raw?.color ?? "888888",
});

export const reviewIngest: GithubKindIngest = {
  kinds: [CHANGE_REQUEST, ISSUE],
  async fetchRepository(http, repository, credential) {
    const rows = await http.paginate<unknown>(
      `/repos/${repository}/issues?state=open&per_page=100`,
      credential,
    );
    return rows.map((raw) => {
      const parsed = GithubIssue.parse(raw);
      const isPullRequest = Boolean(parsed.pull_request);
      const kind = isPullRequest ? CHANGE_REQUEST : ISSUE;
      const number = parsed.number;
      const labels = (parsed.labels ?? []).map(label);
      const state: ReviewState = parsed.draft ? "draft" : "open";
      return {
        id: `github:${repository}:${String(number)}`,
        provider: "github",
        providerRef: { repository, number },
        kind,
        title: parsed.title ?? "",
        location: repository,
        signal: Math.min(100, (parsed.comments ?? 0) * 4 + labels.length * 12),
        createdAt: parsed.created_at ?? "",
        url: parsed.html_url ?? "",
        details: {
          number,
          state,
          body: parsed.body ?? "",
          author: actor(parsed.user),
          assignees: (parsed.assignees ?? []).map(actor),
          reviewers: [],
          comments: parsed.comments ?? 0,
          labels,
          checks: null,
          permalinks: [{
            provider: "github",
            href: parsed.html_url ?? "",
            kind: isPullRequest ? "pr" : "issue",
            label: `#${String(number)}`,
          }],
          relations: [],
        },
      } satisfies TriageItem<ReviewDetails>;
    });
  },
};
