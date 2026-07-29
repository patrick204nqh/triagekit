import type { Kind, TriageItem } from "../../dataset/item";
import type {
  DiscoveryOption,
  FailureCategory,
  Scope,
} from "../../catalog/types";
import type {
  SliceOutcome,
  SliceRequest,
} from "../../cached-dataset/provider";
import { GithubHttpError } from "./http";
import { GithubRepository } from "./schemas";

export interface BoundGithubHttp {
  get<T>(pathOrUrl: string, init?: RequestInit): Promise<T>;
  request<T>(pathOrUrl: string, init?: RequestInit): Promise<T>;
  paginate<T>(pathOrUrl: string, init?: RequestInit): Promise<readonly T[]>;
}

export interface GithubKindIngest {
  kinds: readonly Kind[];
  fetchRepository(
    http: BoundGithubHttp,
    repository: string,
    signal: AbortSignal,
  ): Promise<readonly TriageItem[]>;
}

export async function discoverGithubRepositories(
  http: BoundGithubHttp,
  signal?: AbortSignal,
): Promise<readonly DiscoveryOption[]> {
  const repositories = await http.paginate<unknown>(
    "/user/repos?per_page=100&affiliation=owner,collaborator,organization_member&sort=full_name",
    signal ? { signal } : undefined,
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

export async function* fetchGithubSlices(
  http: BoundGithubHttp,
  ingests: readonly GithubKindIngest[],
  request: {
    readonly scope: Scope;
    readonly slices: readonly SliceRequest[];
    readonly signal: AbortSignal;
  },
  redact: (message: string) => string = (message) => message,
): AsyncIterable<SliceOutcome> {
  const byTarget = new Map<string, Set<Kind>>();
  for (const slice of request.slices) {
    const kinds = byTarget.get(slice.target) ?? new Set<Kind>();
    kinds.add(slice.kind);
    byTarget.set(slice.target, kinds);
  }

  for (const [repository, requestedKinds] of byTarget) {
    for (const ingest of ingests) {
      const kinds = ingest.kinds.filter((kind) => requestedKinds.has(kind));
      if (kinds.length === 0) continue;
      request.signal.throwIfAborted();
      try {
        const items = await ingest.fetchRepository(
          http,
          repository,
          request.signal,
        );
        for (const kind of kinds) {
          yield {
            type: "changed",
            target: repository,
            kind,
            items: items.filter((item) => item.kind === kind),
          };
        }
      } catch (error) {
        if (request.signal.aborted) throw request.signal.reason;
        for (const kind of kinds) {
          yield {
            type: "failed",
            target: repository,
            kind,
            failure: {
              provider: "github",
              kind,
              target: repository,
              category: failureCategory(error),
              message: redact(error instanceof Error ? error.message : String(error)),
            },
          };
        }
      }
    }
  }
}
