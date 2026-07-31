import { ConfigError } from "../core/errors.js";
import type { RuntimeCatalog } from "../catalog/types";
import type { Kind } from "../dataset/item";
import type { ResolvedInsightRoute } from "../insights/routes";
import {
  emptyListState,
  pruneFilters,
  type ListState,
} from "../layout/toolbar/filter-state";
import type {
  SerializedSession,
  SessionAvailability,
  SessionState,
  SessionUpdate,
  TriageSession,
  WorkIntent,
} from "./types";

export interface CreateTriageSessionOptions {
  catalog: RuntimeCatalog;
  initial?: Partial<SessionState>;
}

const frozenState = (state: SessionState): Readonly<SessionState> => {
  const copy = structuredClone(state) as SessionState;
  Object.freeze(copy.filters.axes);
  Object.freeze(copy.filters);
  return Object.freeze(copy);
};

const serializedState = (
  state: Readonly<SessionState>,
): Readonly<SerializedSession> => {
  const { labels: _legacyLabels, ...axes } = state.filters.axes;
  return Object.freeze({
    kind: state.kind,
    provider: state.provider || undefined,
    repository: state.preferredRepository || undefined,
    view: state.view,
    sort: state.filters.sort,
    axes,
  });
};

export function createTriageSession(
  options: CreateTriageSessionOptions,
): TriageSession {
  const { catalog } = options;
  const requestedKind = options.initial?.kind;
  const kind = requestedKind && catalog.kind(requestedKind)
    ? requestedKind
    : catalog.kinds()[0]?.kind;
  if (!kind) throw new ConfigError("cannot create a Triage Session without a Kind");

  const compatibleProviders = (candidate: Kind) =>
    catalog.providersFor(candidate);
  const providerFor = (candidate: Kind, preferred?: string): string => {
    const providers = compatibleProviders(candidate);
    const selected = preferred
      ? providers.find((provider) => provider.id === preferred)
      : undefined;
    return (
      selected
      ?? providers.find((provider) => provider.status === "ready")
      ?? providers[0]
    )?.id ?? "";
  };
  const workFor = (candidate: Kind): WorkIntent =>
    catalog.kind(candidate)?.status === "upcoming" ? "present" : "refresh";
  const viewExists = (candidate: Kind, view: string): boolean =>
    view === "list"
    || view === "insights"
    || catalog.tabs().some((tab) => tab.id === view)
    || catalog.viewsFor(candidate).some((candidateView) => candidateView.id === view);
  const normalizeFilters = (
    candidate: Kind,
    filters: {
      sort?: string;
      axes?: Readonly<Record<string, readonly string[]>>;
    },
  ): ListState => {
    const availableAxes = new Set(
      catalog.filtersFor(candidate).map((axis) => axis.id),
    );
    const axes = Object.fromEntries(
      Object.entries(filters.axes ?? {})
        .filter(([id, values]) =>
          availableAxes.has(id) && Boolean(values?.length)
        )
        .map(([id, values]) => [id, [...values]]),
    );
    return {
      sort: filters.sort && catalog.sortsFor(candidate)
        .some((sort) => sort.id === filters.sort)
        ? filters.sort
        : "priority",
      axes,
    };
  };

  let state = frozenState({
    kind,
    provider: providerFor(kind, options.initial?.provider),
    preferredRepository: options.initial?.preferredRepository ?? "",
    effectiveRepository: options.initial?.effectiveRepository ?? "",
    view: options.initial?.view ?? "list",
    filters: options.initial?.filters ?? emptyListState(),
  });

  const update = (next: SessionState, work: WorkIntent): SessionUpdate => {
    state = frozenState(next);
    return Object.freeze({
      state,
      serialized: serializedState(state),
      work,
    });
  };
  const unchanged = (): SessionUpdate => Object.freeze({
    state,
    serialized: serializedState(state),
    work: "none",
  });

  return {
    snapshot: () => state,
    serialize: () => serializedState(state),

    selectKind(candidate) {
      if (!catalog.kind(candidate) || candidate === state.kind) {
        return unchanged();
      }
      return update({
        kind: candidate,
        provider: providerFor(candidate, state.provider),
        preferredRepository: state.preferredRepository,
        effectiveRepository: "",
        view: "list",
        filters: emptyListState(),
      }, workFor(candidate));
    },

    selectProvider(providerId) {
      const provider = catalog.provider(providerId);
      if (
        !provider
        || !provider.kinds.includes(state.kind)
        || providerId === state.provider
      ) {
        return unchanged();
      }
      return update({
        ...state,
        provider: providerId,
        preferredRepository: "",
        effectiveRepository: "",
        filters: emptyListState(),
      }, workFor(state.kind));
    },

    selectRepository(repository, rows) {
      if (
        repository !== ""
        && !rows.some((row) => row.location === repository)
      ) {
        return unchanged();
      }
      if (
        repository === state.preferredRepository
        && repository === state.effectiveRepository
      ) {
        return unchanged();
      }
      const artifact = catalog.artifact(state.kind);
      const scopedRows = repository
        ? rows.filter((row) => row.location === repository)
        : [...rows];
      const filters = artifact
        ? pruneFilters(state.filters, scopedRows, { artifact }, catalog)
        : state.filters;
      return update({
        ...state,
        preferredRepository: repository,
        effectiveRepository: repository,
        filters,
      }, "rederive");
    },

    selectView(view) {
      const nextView = view && viewExists(state.kind, view) ? view : "list";
      if (nextView === state.view) return unchanged();
      return update({ ...state, view: nextView }, "present");
    },

    changeFilters(filters) {
      return update({
        ...state,
        filters: normalizeFilters(state.kind, filters),
      }, "rederive");
    },

    openInsightRoute(
      route: Extract<ResolvedInsightRoute, { destination: "list" }>,
    ) {
      return update({
        kind: route.kind,
        provider: providerFor(route.kind, state.provider),
        preferredRepository: route.preferredRepository,
        effectiveRepository: route.preferredRepository,
        view: "list",
        filters: normalizeFilters(route.kind, route.filters),
      }, "rederive");
    },

    restore(serialized) {
      const requestedKind = serialized.kind as Kind | undefined;
      const restoredKind = requestedKind && catalog.kind(requestedKind)
        ? requestedKind
        : catalog.kinds()[0]!.kind;
      const restoredProvider = providerFor(
        restoredKind,
        serialized.provider,
      );
      const restoredView = serialized.view
        && viewExists(restoredKind, serialized.view)
        ? serialized.view
        : "list";
      return update({
        kind: restoredKind,
        provider: restoredProvider,
        preferredRepository: serialized.repository ?? "",
        effectiveRepository: "",
        view: restoredView,
        filters: normalizeFilters(restoredKind, {
          sort: serialized.sort,
          axes: serialized.axes,
        }),
      }, workFor(restoredKind));
    },

    reconcile(availability: SessionAvailability) {
      const preferred = state.preferredRepository;
      const effective = preferred
        && availability.repositories.includes(preferred)
        ? preferred
        : "";
      const view = availability.views.includes(state.view)
        ? state.view
        : "list";
      const repositoryChanged = effective !== state.effectiveRepository;
      const viewChanged = view !== state.view;
      if (!repositoryChanged && !viewChanged) return unchanged();
      return update({
        ...state,
        effectiveRepository: effective,
        view,
      }, repositoryChanged ? "rederive" : "present");
    },
  };
}
