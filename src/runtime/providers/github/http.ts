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

export interface GithubHttp {
  get<T>(
    pathOrUrl: string,
    credential: string,
    init?: RequestInit,
  ): Promise<T>;
  request<T>(
    pathOrUrl: string,
    credential: string,
    init?: RequestInit,
  ): Promise<T>;
  paginate<T>(
    pathOrUrl: string,
    credential: string,
    init?: RequestInit,
  ): Promise<readonly T[]>;
}

const urlFor = (pathOrUrl: string): string =>
  pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `${API_ROOT}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;

export function createGithubHttp(fetchImpl: typeof fetch): GithubHttp {
  const fetchResponse = async (
    pathOrUrl: string,
    credential: string,
    init: RequestInit = {},
  ): Promise<Response> => {
    let response: Response;
    try {
      response = await fetchImpl(urlFor(pathOrUrl), {
        ...init,
        headers: {
          Authorization: `Bearer ${credential}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          ...init.headers,
        },
      });
    } catch (error) {
      throw new GithubHttpError(0, error instanceof Error ? error.message : String(error));
    }
    if (!response.ok) {
      let message = `${response.status}`;
      try {
        const body = await response.json() as { message?: string };
        if (body.message) message += ` ${body.message}`;
      } catch {
        // Status is sufficient when GitHub did not return JSON.
      }
      throw new GithubHttpError(
        response.status,
        message,
        response.status === 403 && response.headers.has("x-github-sso"),
      );
    }
    return response;
  };
  const request = async <T>(
    pathOrUrl: string,
    credential: string,
    init: RequestInit = {},
  ): Promise<T> =>
    (await fetchResponse(pathOrUrl, credential, init)).json() as Promise<T>;

  return {
    get: <T>(pathOrUrl: string, credential: string, init?: RequestInit) =>
      request<T>(pathOrUrl, credential, init),
    request,
    async paginate<T>(
      pathOrUrl: string,
      credential: string,
      init: RequestInit = {},
    ) {
      const rows: T[] = [];
      let next: string | null = urlFor(pathOrUrl);
      while (next) {
        const response = await fetchResponse(next, credential, init);
        rows.push(...await response.json() as T[]);
        const link = response.headers.get("link") ?? "";
        const match = link.match(/<([^>]+)>;\s*rel="next"/);
        next = match?.[1] ?? null;
      }
      return rows;
    },
  };
}
