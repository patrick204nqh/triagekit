import { ProviderError } from "../../core/errors.js";
import type { Kind } from "../../dataset/item";
import type {
  ProviderCommand,
  ProviderDeclaration,
} from "../../catalog/types";
import type {
  BoundProvider,
  ProviderDefinition,
} from "../../cached-dataset/provider";
import { canonicalGithubScope } from "../../cached-dataset/identity";
import { createGithubHttp, type GithubHttp } from "./http";
import {
  createGithubRequestScheduler,
  type GithubSchedulerStatus,
} from "./scheduler";
import { GithubPullRequest, GithubCheckRunsResponse } from "./schemas";
import {
  discoverGithubRepositories,
  fetchGithubSlices,
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
    throw new ProviderError("github", "reference", "expected object with repository and number");
  }
  const candidate = value as Partial<GithubReference>;
  if (typeof candidate.repository !== "string"
    || typeof candidate.number !== "number") {
    throw new ProviderError("github", "reference", "expected object with string repository and number number");
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
): Promise<unknown> {
  if (kind !== "change-request") {
    throw new ProviderError("github", "enrich", `enrichment is not declared for "${kind}"`);
  }
  const { repository, number } = reference(providerRef);
  const pullRaw = await http.get<unknown>(
    `/repos/${repository}/pulls/${number}`,
    { priority: "enrichment", retry: "safe-read" },
  );
  const pull = GithubPullRequest.parse(pullRaw);
  let checks = null;
  if (pull.head?.sha) {
    const resultRaw = await http.get<unknown>(
      `/repos/${repository}/commits/${pull.head.sha}/check-runs`,
      { priority: "enrichment", retry: "safe-read" },
    );
    const result = GithubCheckRunsResponse.parse(resultRaw);
    const runs = result.check_runs ?? [];
    checks = {
      state: runs.some((run) =>
        ["failure", "timed_out", "cancelled", "action_required"]
          .includes(run.conclusion ?? ""))
        ? "fail"
        : runs.some((run) => run.status !== "completed")
          ? "pending" : "pass",
      conflicts: pull.mergeable === false || pull.mergeable_state === "dirty",
    };
  }
  return {
    reviewers: (pull.requested_reviewers ?? []).map((reviewer) => ({
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
): Promise<void> {
  const declared = actions[command.kind] ?? [];
  if (!declared.includes(command.action)) {
    throw new ProviderError("github", "execute",
      `action "${command.action}" is not declared for "${command.kind}"`);
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
  await http.request(route.path, {
    priority: "triage-action",
    retry: "never",
    init: {
      method: route.method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(route.body),
    },
  });
}

export interface GithubBoundProvider extends BoundProvider {
  enrich(kind: Kind, providerRef: unknown): Promise<unknown>;
  execute(command: ProviderCommand): Promise<void>;
  status(): GithubSchedulerStatus;
  subscribeStatus(
    observer: (status: GithubSchedulerStatus) => void,
  ): () => void;
}

export type GithubProviderDefinition =
  ProviderDefinition & ProviderDeclaration & {
  bind(credential: string): Promise<GithubBoundProvider>;
};

export function createGithubProvider(
  fetchImpl: typeof fetch,
): GithubProviderDefinition {
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
    async bind(rawCredential) {
      const credential = rawCredential.trim();
      const statusObservers = new Set<
        (status: GithubSchedulerStatus) => void
      >();
      const scheduler = createGithubRequestScheduler({
        fetch: fetchImpl,
        onStatusChange(status) {
          for (const observer of statusObservers) observer(status);
        },
      });
      const http = createGithubHttp(credential, scheduler);
      let closed = false;
      const ensureOpen = (): void => {
        if (closed) {
          throw new ProviderError("github", "connection", "Provider Connection is closed");
        }
      };
      const redact = (message: string): string =>
        credential.length > 0
          ? message.split(credential).join("[redacted]")
          : message;

      return {
        discoverScope(signal) {
          ensureOpen();
          return discoverGithubRepositories(http, signal);
        },
        canonicalizeScope: canonicalGithubScope,
        targets(scope) {
          return canonicalGithubScope(scope).repos as readonly string[];
        },
        fetchSlices(request) {
          const stream = async function* () {
            ensureOpen();
            yield* fetchGithubSlices(
              http,
              githubKindIngests,
              {
                ...request,
                scope: canonicalGithubScope(request.scope),
              },
              redact,
            );
          };
          return stream();
        },
        enrich(kind, providerRef) {
          ensureOpen();
          return enrichGithubItem(http, kind, providerRef);
        },
        execute(command) {
          ensureOpen();
          return executeGithubCommand(http, command);
        },
        status() {
          return scheduler.status();
        },
        subscribeStatus(observer) {
          statusObservers.add(observer);
          observer(scheduler.status());
          return () => statusObservers.delete(observer);
        },
        close() {
          closed = true;
          statusObservers.clear();
          scheduler.close();
        },
      };
    },
  };
}
