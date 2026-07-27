import type { SerializedSession } from "./types";

const RESERVED = new Set([
  "artifact",
  "provider",
  "repo",
  "view",
  "sort",
]);

const canonicalProvider = (provider: string | null): string | undefined => {
  if (!provider) return undefined;
  if (
    provider === "github-review"
    || provider === "github-code-scanning"
  ) {
    return "github";
  }
  return provider;
};

export function parseSessionQuery(search: string): SerializedSession {
  const params = new URLSearchParams(search);
  const axes: Record<string, readonly string[]> = {};
  for (const [key, value] of params.entries()) {
    if (RESERVED.has(key) || !value) continue;
    const values = value.split(",").filter(Boolean);
    if (values.length) axes[key] = values;
  }

  const state: SerializedSession = {};
  const kind = params.get("artifact");
  const provider = canonicalProvider(params.get("provider"));
  const repository = params.get("repo");
  const view = params.get("view");
  const sort = params.get("sort");
  if (kind) state.kind = kind;
  if (provider) state.provider = provider;
  if (repository) state.repository = repository;
  if (view) state.view = view;
  if (sort) state.sort = sort;
  if (Object.keys(axes).length) state.axes = axes;
  return state;
}

export function serializeSessionQuery(state: SerializedSession): string {
  const params = new URLSearchParams();
  if (state.kind) params.set("artifact", state.kind);
  if (state.provider) params.set("provider", state.provider);
  if (state.repository) params.set("repo", state.repository);
  if (state.view) params.set("view", state.view);
  if (state.sort) params.set("sort", state.sort);
  for (const [id, values] of Object.entries(state.axes ?? {})) {
    if (values.length) params.set(id, values.join(","));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
