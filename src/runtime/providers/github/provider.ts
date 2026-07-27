import type { Kind } from "../../dataset/item";
import type {
  ProviderCommand,
  ProviderDeclaration,
} from "../../catalog/types";
import { createGithubHttp, type GithubHttp } from "./http";
import {
  discoverGithubRepositories,
  refreshGithubKinds,
  type GithubKindIngest,
} from "./repository-ingest";
import { dependencyVulnIngest } from "./kinds/dependency-vuln";
import { codeScanningIngest } from "./kinds/code-scanning";
import { reviewIngest } from "./kinds/review";

const githubKindIngests: readonly GithubKindIngest[] = [
  dependencyVulnIngest,
  codeScanningIngest,
  reviewIngest,
];

interface GithubReference {
  repository: string;
  number: number;
}

const reference = (value: unknown): GithubReference => {
  if (!value || typeof value !== "object") {
    throw new Error("invalid GitHub Provider Reference");
  }
  const candidate = value as Partial<GithubReference>;
  if (typeof candidate.repository !== "string"
    || typeof candidate.number !== "number") {
    throw new Error("invalid GitHub Provider Reference");
  }
  return candidate as GithubReference;
};

const actions: Readonly<Partial<Record<Kind, readonly string[]>>> = {
  "change-request": ["merge", "comment", "label"],
  issue: ["comment", "assign", "close", "label"],
};

async function enrichGithubItem(
  http: GithubHttp,
  kind: Kind,
  providerRef: unknown,
  credential: string,
): Promise<unknown> {
  if (kind !== "change-request") {
    throw new Error(`GitHub enrichment is not declared for "${kind}"`);
  }
  const { repository, number } = reference(providerRef);
  const pull = await http.get<any>(
    `/repos/${repository}/pulls/${number}`,
    credential,
  );
  let checks = null;
  if (pull.head?.sha) {
    const result = await http.get<any>(
      `/repos/${repository}/commits/${pull.head.sha}/check-runs`,
      credential,
    );
    const runs = result.check_runs ?? [];
    checks = {
      state: runs.some((run: any) =>
        ["failure", "timed_out", "cancelled", "action_required"]
          .includes(run.conclusion))
        ? "fail"
        : runs.some((run: any) => run.status !== "completed")
          ? "pending" : "pass",
      conflicts: pull.mergeable === false || pull.mergeable_state === "dirty",
    };
  }
  return {
    reviewers: (pull.requested_reviewers ?? []).map((reviewer: any) => ({
      login: reviewer.login ?? "unknown",
      avatarUrl: reviewer.avatar_url ?? "",
      kind: reviewer.type === "Bot" ? "bot" : "human",
    })),
    checks,
  };
}

async function executeGithubCommand(
  http: GithubHttp,
  command: ProviderCommand,
  credential: string,
): Promise<void> {
  const declared = actions[command.kind] ?? [];
  if (!declared.includes(command.action)) {
    throw new Error(
      `GitHub action "${command.action}" is not declared for "${command.kind}"`,
    );
  }
  const { repository, number } = reference(command.ref);
  const payload = command.payload ?? {};
  const routes: Record<string, { method: string; path: string; body: unknown }> = {
    merge: {
      method: "PUT",
      path: `/repos/${repository}/pulls/${number}/merge`,
      body: payload,
    },
    comment: {
      method: "POST",
      path: `/repos/${repository}/issues/${number}/comments`,
      body: payload,
    },
    label: {
      method: "POST",
      path: `/repos/${repository}/issues/${number}/labels`,
      body: payload,
    },
    assign: {
      method: "POST",
      path: `/repos/${repository}/issues/${number}/assignees`,
      body: payload,
    },
    close: {
      method: "PATCH",
      path: `/repos/${repository}/issues/${number}`,
      body: { state: "closed" },
    },
  };
  const route = routes[command.action];
  await http.request(route.path, credential, {
    method: route.method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(route.body),
  });
}

export function createGithubProvider(
  fetchImpl: typeof fetch,
): ProviderDeclaration {
  const http = createGithubHttp(fetchImpl);
  return {
    id: "github",
    label: "GitHub",
    status: "ready",
    kinds: [
      "dependency-vuln",
      "code-scanning",
      "change-request",
      "issue",
    ],
    connection: {
      setupHint: "Use a fine-grained personal access token with access to repositories you triage.",
      setupUrl: "https://github.com/settings/personal-access-tokens",
      scopeFields: [{
        key: "repos",
        label: "Repositories",
        type: "multiselect",
        discoverable: true,
        required: true,
      }],
    },
    capabilities: {
      discoverScope: true,
      enrich: ["change-request"],
      actions,
    },
    adapter: {
      refresh: (request) =>
        refreshGithubKinds(http, githubKindIngests, request),
      discoverScope: (credential) =>
        discoverGithubRepositories(http, credential),
      enrich: (kind, providerRef, credential) =>
        enrichGithubItem(http, kind, providerRef, credential),
      execute: (command, credential) =>
        executeGithubCommand(http, command, credential),
    },
  };
}
