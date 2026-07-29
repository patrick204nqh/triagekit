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
import {
  GithubHttpError,
  type GithubHttp,
} from "./http";
import { GithubRepository } from "./schemas";
import type { RequestPriority } from "./scheduler";

export interface GithubIngestResult {
  readonly items: readonly TriageItem[];
  readonly validator?: string;
  readonly unchanged: boolean;
}

export interface GithubKindIngest {
  kinds: readonly Kind[];
  fetchRepository(
    http: GithubHttp,
    repository: string,
    signal: AbortSignal,
    priority: RequestPriority,
    validator?: string,
  ): Promise<GithubIngestResult>;
}

export async function discoverGithubRepositories(
  http: GithubHttp,
  signal?: AbortSignal,
): Promise<readonly DiscoveryOption[]> {
  const { rows: repositories } = await http.paginate<unknown>(
    "/user/repos?per_page=100&affiliation=owner,collaborator,organization_member&sort=full_name",
    {
      priority: "enrichment",
      retry: "safe-read",
      ...(signal ? { signal } : {}),
    },
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

const isCodeSecurityScopeFailure = (error: GithubHttpError): boolean =>
  error.status === 403
  && error.message.toLowerCase().includes(
    "code security must be enabled for this repository",
  );

const failureCategory = (error: unknown): FailureCategory => {
  if (!(error instanceof GithubHttpError)) return "network";
  if (error.status === 401 || error.ssoRequired) return "auth";
  if (isCodeSecurityScopeFailure(error)) return "scope";
  if (error.status === 403) return "rate-limit";
  if (error.status === 404) return "not-found";
  return error.status === 0 ? "network" : "provider";
};

export async function* fetchGithubSlices(
  http: GithubHttp,
  ingests: readonly GithubKindIngest[],
  request: {
    readonly scope: Scope;
    readonly slices: readonly SliceRequest[];
    readonly signal: AbortSignal;
    readonly priority?: Extract<
      RequestPriority,
      "manual-refresh" | "startup-refresh" | "cadence-refresh"
    >;
  },
  redact: (message: string) => string = (message) => message,
): AsyncIterable<SliceOutcome> {
  for (const slice of request.slices) {
    const ingest = ingests.find(({ kinds }) => kinds.includes(slice.kind));
    if (!ingest) continue;
    request.signal.throwIfAborted();
    try {
      const result = await ingest.fetchRepository(
        http,
        slice.target,
        request.signal,
        request.priority ?? "manual-refresh",
        slice.validator,
      );
      if (result.unchanged && result.validator) {
        yield {
          type: "unchanged",
          target: slice.target,
          kind: slice.kind,
          validator: result.validator,
        };
        continue;
      }
      yield {
        type: "changed",
        target: slice.target,
        kind: slice.kind,
        items: result.items.filter((item) => item.kind === slice.kind),
        ...(result.validator ? { validator: result.validator } : {}),
      };
    } catch (error) {
      if (request.signal.aborted) throw request.signal.reason;
      yield {
        type: "failed",
        target: slice.target,
        kind: slice.kind,
        failure: {
          provider: "github",
          kind: slice.kind,
          target: slice.target,
          category: failureCategory(error),
          message: redact(error instanceof Error ? error.message : String(error)),
        },
      };
    }
  }
}
