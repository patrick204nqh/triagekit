import type { Kind, TriageItem } from "../../dataset/item";
import type {
  DiscoveryOption,
  FailureCategory,
  KindRefreshOutcome,
  RefreshRequest,
  TriageFailure,
} from "../../catalog/types";
import { GithubHttpError, type GithubHttp } from "./http";
import { GithubRepository } from "./schemas";

export interface GithubKindIngest {
  kinds: readonly Kind[];
  fetchRepository(
    http: GithubHttp,
    repository: string,
    credential: string,
  ): Promise<readonly TriageItem[]>;
}

export async function discoverGithubRepositories(
  http: GithubHttp,
  credential: string,
): Promise<readonly DiscoveryOption[]> {
  const repositories = await http.paginate<unknown>(
    "/user/repos?per_page=100&affiliation=owner,collaborator,organization_member&sort=full_name",
    credential,
  );
  return repositories.map((raw) => {
    const repo = GithubRepository.parse(raw);
    return {
      value: repo.full_name,
      label: repo.name,
      group: repo.owner?.login,
    };
  });
}

const failureCategory = (error: unknown): FailureCategory => {
  if (!(error instanceof GithubHttpError)) return "network";
  if (error.status === 401 || error.ssoRequired) return "auth";
  if (error.status === 403) return "rate-limit";
  if (error.status === 404) return "not-found";
  return error.status === 0 ? "network" : "provider";
};

export async function refreshGithubKinds(
  http: GithubHttp,
  ingests: readonly GithubKindIngest[],
  request: RefreshRequest,
): Promise<readonly KindRefreshOutcome[]> {
  const repositories = Array.isArray(request.scope.repos)
    ? request.scope.repos.filter((value): value is string => typeof value === "string")
    : [];
  const selectedKinds = new Set(request.kinds);
  const outcomes = new Map<Kind, {
    items: TriageItem[];
    failures: TriageFailure[];
    successes: number;
  }>();
  for (const kind of request.kinds) {
    outcomes.set(kind, { items: [], failures: [], successes: 0 });
  }

  await Promise.all(ingests.flatMap((ingest) =>
    repositories.map(async (repository) => {
      const kinds = ingest.kinds.filter((kind) => selectedKinds.has(kind));
      if (!kinds.length) return;
      try {
        const items = await ingest.fetchRepository(
          http,
          repository,
          request.credential,
        );
        for (const kind of kinds) {
          const outcome = outcomes.get(kind)!;
          outcome.successes++;
          outcome.items.push(...items.filter((item) => item.kind === kind));
        }
      } catch (error) {
        for (const kind of kinds) {
          outcomes.get(kind)!.failures.push({
            provider: "github",
            kind,
            target: repository,
            category: failureCategory(error),
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    })));

  return request.kinds.map((kind) => {
    const outcome = outcomes.get(kind)!;
    const status = outcome.failures.length === 0
      ? "success"
      : outcome.successes > 0 ? "partial" : "failed";
    return {
      kind,
      status,
      items: status === "failed" ? [] : outcome.items,
      failures: outcome.failures,
    };
  });
}
