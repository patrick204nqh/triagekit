import type { Scope } from "../catalog/types";

export function canonicalGithubScope(scope: Scope): Scope {
  const repos = Array.isArray(scope.repos)
    ? [...new Set(scope.repos.filter((value): value is string =>
      typeof value === "string" && value.length > 0))].sort()
    : [];
  return Object.freeze({ repos: Object.freeze(repos) });
}

export async function createConnectionKey(
  provider: string,
  credential: string,
  scope: Scope,
): Promise<string> {
  const material = new TextEncoder().encode(
    `${provider}\0${credential.trim()}\0${JSON.stringify(scope)}`,
  );
  const digest = await crypto.subtle.digest("SHA-256", material);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
