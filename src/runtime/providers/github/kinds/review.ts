import type { TriageItem } from "../../../dataset/item";
import type { Actor, Label } from "../../../dataset/shared";
import {
  CHANGE_REQUEST,
  ISSUE,
  type ReviewDetails,
  type ReviewState,
} from "../../../dataset/shapes/review";
import type { GithubKindIngest } from "../repository-ingest";

const bots = ["dependabot", "renovate", "github-actions", "snyk"];
const actor = (raw: any): Actor => {
  const login = raw?.login ?? "unknown";
  return {
    login,
    avatarUrl: raw?.avatar_url ?? "",
    kind: raw?.type === "Bot"
      || login.toLowerCase().endsWith("[bot]")
      || bots.includes(login.toLowerCase()) ? "bot" : "human",
  };
};
const label = (raw: any): Label => ({
  name: raw?.name ?? "",
  color: raw?.color ?? "888888",
});

export const reviewIngest: GithubKindIngest = {
  kinds: [CHANGE_REQUEST, ISSUE],
  async fetchRepository(http, repository, credential) {
    const rows = await http.paginate<any>(
      `/repos/${repository}/issues?state=open&per_page=100`,
      credential,
    );
    return rows.map((raw) => {
      const isPullRequest = Boolean(raw.pull_request);
      const kind = isPullRequest ? CHANGE_REQUEST : ISSUE;
      const number = raw.number;
      const labels = (raw.labels ?? []).map(label);
      const state: ReviewState = raw.draft ? "draft" : "open";
      return {
        id: `github:${repository}:${number}`,
        provider: "github",
        providerRef: { repository, number },
        kind,
        title: raw.title ?? "",
        location: repository,
        signal: Math.min(100, (raw.comments ?? 0) * 4 + labels.length * 12),
        createdAt: raw.created_at ?? "",
        url: raw.html_url ?? "",
        details: {
          number,
          state,
          body: raw.body ?? "",
          author: actor(raw.user),
          assignees: (raw.assignees ?? []).map(actor),
          reviewers: [],
          comments: raw.comments ?? 0,
          labels,
          checks: null,
          permalinks: [{
            provider: "github",
            href: raw.html_url ?? "",
            kind: isPullRequest ? "pr" : "issue",
            label: `#${number}`,
          }],
          relations: [],
        },
      } satisfies TriageItem<ReviewDetails>;
    });
  },
};
