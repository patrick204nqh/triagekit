import type { RuntimeCatalog } from "../catalog/types";
import type { Kind } from "../dataset/item";
import type { ListState } from "../layout/toolbar/filter-state";

export type InsightRoute =
  | Readonly<{
      destination: "list";
      kind: Kind;
      repository?: string;
      filters?: Readonly<Record<string, readonly string[]>>;
    }>
  | Readonly<{
      destination: "scoring" | "filters";
    }>;

export type ResolvedInsightRoute =
  | Readonly<{
      destination: "list";
      kind: Kind;
      view: "list";
      preferredRepository: string;
      filters: ListState;
    }>
  | Readonly<{
      destination: "settings";
      category: "scoring" | "filters";
    }>;

export interface ResolveInsightRouteInput {
  route: InsightRoute;
  catalog: RuntimeCatalog;
  repositories: readonly string[];
}

export function resolveInsightRoute(
  input: ResolveInsightRouteInput,
): ResolvedInsightRoute {
  if (input.route.destination !== "list") {
    return Object.freeze({
      destination: "settings",
      category: input.route.destination,
    });
  }

  const kind = input.catalog.readyKind(input.route.kind);
  if (!kind) {
    throw new Error(`insight List route requires ready kind "${input.route.kind}"`);
  }
  const axesForKind = new Set(
    input.catalog.filtersFor(kind.kind).map((axis) => axis.id),
  );
  const axes = Object.fromEntries(
    Object.entries(input.route.filters ?? {})
      .filter(([id, values]) => axesForKind.has(id) && values.length > 0)
      .map(([id, values]) => [id, [...values]]),
  );
  const preferredRepository = input.route.repository
    && input.repositories.includes(input.route.repository)
    ? input.route.repository
    : "";

  return Object.freeze({
    destination: "list",
    kind: kind.kind,
    view: "list",
    preferredRepository,
    filters: {
      sort: "priority",
      axes,
    },
  });
}
