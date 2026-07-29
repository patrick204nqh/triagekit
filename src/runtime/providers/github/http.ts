import {
  GithubOutcomeUnknownError,
  type GithubRequestScheduler,
  type RequestPriority,
  type ScheduledRequest,
} from "./scheduler";

const API_ROOT = "https://api.github.com";

export class GithubHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly ssoRequired: boolean = false,
  ) {
    super(message);
    this.name = "GithubHttpError";
  }
}

export interface GithubRequestOptions {
  readonly priority: RequestPriority;
  readonly retry: ScheduledRequest["retry"];
  readonly validator?: string;
  readonly signal?: AbortSignal;
  readonly init?: RequestInit;
}

export interface GithubPaginatedResult<T> {
  readonly rows: readonly T[];
  readonly validator?: string;
  readonly unchanged: boolean;
}

export interface GithubHttp {
  get<T>(
    pathOrUrl: string,
    options: GithubRequestOptions,
  ): Promise<T>;
  request<T>(
    pathOrUrl: string,
    options: GithubRequestOptions,
  ): Promise<T>;
  paginate<T>(
    pathOrUrl: string,
    options: GithubRequestOptions,
  ): Promise<GithubPaginatedResult<T>>;
}

const urlFor = (pathOrUrl: string): string =>
  pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `${API_ROOT}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;

const errorFor = async (response: Response): Promise<GithubHttpError> => {
  let message = `${response.status}`;
  try {
    const body = await response.json() as { message?: string };
    if (body.message) message += ` ${body.message}`;
  } catch {
    // Status is sufficient when GitHub did not return JSON.
  }
  return new GithubHttpError(
    response.status,
    message,
    response.status === 403 && response.headers.has("x-github-sso"),
  );
};

export function createGithubHttp(
  credential: string,
  scheduler: GithubRequestScheduler,
): GithubHttp {
  const fetchResponse = async (
    pathOrUrl: string,
    options: GithubRequestOptions,
    includeValidator: boolean,
  ): Promise<Response> => {
    const headers = new Headers(options.init?.headers);
    headers.set("authorization", `Bearer ${credential}`);
    headers.set("accept", "application/vnd.github+json");
    headers.set("x-github-api-version", "2022-11-28");
    if (includeValidator && options.validator) {
      headers.set("if-none-match", options.validator);
    }

    let response: Response;
    try {
      response = await scheduler.run({
        pathOrUrl: urlFor(pathOrUrl),
        init: {
          ...options.init,
          headers,
        },
        priority: options.priority,
        retry: options.retry,
        signal: options.signal,
      });
    } catch (error) {
      if (error instanceof GithubOutcomeUnknownError) throw error;
      throw new GithubHttpError(
        0,
        error instanceof Error ? error.message : String(error),
      );
    }
    if (response.status !== 304 && !response.ok) throw await errorFor(response);
    return response;
  };

  const request = async <T>(
    pathOrUrl: string,
    options: GithubRequestOptions,
  ): Promise<T> => {
    const response = await fetchResponse(pathOrUrl, options, true);
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  };

  return {
    get: request,
    request,
    async paginate<T>(
      pathOrUrl: string,
      options: GithubRequestOptions,
    ): Promise<GithubPaginatedResult<T>> {
      const rows: T[] = [];
      let next: string | null = urlFor(pathOrUrl);
      let validator: string | undefined;
      let firstPage = true;

      while (next) {
        const response = await fetchResponse(next, options, firstPage);
        if (firstPage) {
          validator = response.headers.get("etag")
            ?? options.validator
            ?? undefined;
          if (response.status === 304) {
            return {
              rows: [],
              ...(validator ? { validator } : {}),
              unchanged: true,
            };
          }
        }
        rows.push(...await response.json() as T[]);
        const link = response.headers.get("link") ?? "";
        const match = link.match(/<([^>]+)>;\s*rel="next"/);
        next = match?.[1] ?? null;
        firstPage = false;
      }

      return {
        rows,
        ...(validator ? { validator } : {}),
        unchanged: false,
      };
    },
  };
}
