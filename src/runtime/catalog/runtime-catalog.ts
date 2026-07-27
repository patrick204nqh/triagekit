import type { Kind } from "../dataset/item";
import { getDomain } from "../dataset/taxonomy";
import { baseFields } from "../scoring/field-catalog";
import type { FilterAxis, SortKey } from "../layout/toolbar/axis-registry";
import type { TriageChart } from "../layout/charts/registry";
import type { ViewModule } from "../views/registry";
import type {
  KindDeclaration,
  ProviderDeclaration,
  ReadyKindDeclaration,
  RuntimeCatalog,
  RuntimeDefaults,
} from "./types";

const EMPTY_DEFAULTS: RuntimeDefaults = {
  filters: [],
  sorts: [],
  charts: [],
  tabs: [],
};

export interface RuntimeCatalogInput {
  kinds: readonly KindDeclaration[];
  providers: readonly ProviderDeclaration[];
  defaults?: Partial<RuntimeDefaults>;
}

function addUnique<T extends { id: string }>(
  map: Map<string, T>,
  value: T,
  noun: string,
): void {
  const existing = map.get(value.id);
  if (existing && existing !== value) {
    throw new Error(`duplicate ${noun} identifier: ${value.id}`);
  }
  map.set(value.id, value);
}

function validateReadyKind(kind: ReadyKindDeclaration): void {
  if (kind.renderer.kind !== kind.kind) {
    throw new Error(
      `kind "${kind.kind}": renderer declares "${kind.renderer.kind}"`,
    );
  }

  const views = new Set<string>();
  for (const view of kind.views) {
    if (view.kind !== kind.kind) {
      throw new Error(
        `kind "${kind.kind}": view "${view.id}" declares "${view.kind}"`,
      );
    }
    if (views.has(view.id)) {
      throw new Error(
        `kind "${kind.kind}": duplicate view identifier "${view.id}"`,
      );
    }
    views.add(view.id);
  }
}

function validateProvider(
  provider: ProviderDeclaration,
  kinds: ReadonlyMap<Kind, KindDeclaration>,
): void {
  if (provider.status === "ready" && !provider.adapter) {
    throw new Error(`provider "${provider.id}" requires an adapter`);
  }

  const supported = new Set(provider.kinds);
  for (const kind of provider.kinds) {
    if (!kinds.has(kind)) {
      throw new Error(
        `provider "${provider.id}" references kind "${kind}" that is unregistered`,
      );
    }
  }
  for (const kind of provider.capabilities.enrich) {
    if (!supported.has(kind)) {
      throw new Error(
        `provider "${provider.id}" enrichment references unsupported kind "${kind}"`,
      );
    }
  }
  for (const kind of Object.keys(provider.capabilities.actions) as Kind[]) {
    if (!supported.has(kind)) {
      throw new Error(
        `provider "${provider.id}" actions reference unsupported kind "${kind}"`,
      );
    }
  }
}

export function createRuntimeCatalog(
  input: RuntimeCatalogInput,
): RuntimeCatalog {
  const kindMap = new Map<Kind, KindDeclaration>();
  for (const kind of input.kinds) {
    if (kindMap.has(kind.kind)) {
      throw new Error(`duplicate kind identifier: ${kind.kind}`);
    }
    if (kind.status === "ready") validateReadyKind(kind);
    kindMap.set(kind.kind, kind);
  }

  const providerMap = new Map<string, ProviderDeclaration>();
  for (const provider of input.providers) {
    if (providerMap.has(provider.id)) {
      throw new Error(`duplicate provider identifier: ${provider.id}`);
    }
    validateProvider(provider, kindMap);
    providerMap.set(provider.id, provider);
  }

  const defaults: RuntimeDefaults = {
    filters: input.defaults?.filters ?? EMPTY_DEFAULTS.filters,
    sorts: input.defaults?.sorts ?? EMPTY_DEFAULTS.sorts,
    charts: input.defaults?.charts ?? EMPTY_DEFAULTS.charts,
    tabs: input.defaults?.tabs ?? EMPTY_DEFAULTS.tabs,
  };

  const filterMap = new Map<string, FilterAxis>();
  const sortMap = new Map<string, SortKey>();
  const chartMap = new Map<string, TriageChart>();
  for (const filter of defaults.filters) {
    addUnique(filterMap, filter, "filter");
  }
  for (const sort of defaults.sorts) addUnique(sortMap, sort, "sort");
  for (const chart of defaults.charts) addUnique(chartMap, chart, "chart");
  for (const kind of kindMap.values()) {
    if (kind.status !== "ready") continue;
    for (const filter of kind.filters) {
      addUnique(filterMap, filter, "filter");
    }
    for (const sort of kind.sorts) addUnique(sortMap, sort, "sort");
    for (const chart of kind.charts) addUnique(chartMap, chart, "chart");
  }

  const kinds = Object.freeze([...kindMap.values()]);
  const providers = Object.freeze([...providerMap.values()]);
  const artifacts = Object.freeze(kinds.map((kind) => Object.freeze({
    id: kind.kind,
    label: kind.label,
    group: getDomain(kind.domain).class,
    kinds: [kind.kind],
  })));
  const artifactMap = new Map(
    artifacts.map((artifact) => [artifact.id as Kind, artifact]),
  );
  const tabs = Object.freeze([...defaults.tabs]);

  const readyKind = (id: Kind): ReadyKindDeclaration | undefined => {
    const declaration = kindMap.get(id);
    return declaration?.status === "ready" ? declaration : undefined;
  };

  return Object.freeze({
    kind: (id: Kind) => kindMap.get(id),
    readyKind,
    kinds: () => kinds,
    artifact: (id: Kind) => artifactMap.get(id),
    artifacts: () => artifacts,
    provider: (id: string) => providerMap.get(id),
    providers: () => providers,
    providersFor: (kind: Kind) => Object.freeze(
      providers.filter((provider) => provider.kinds.includes(kind)),
    ),
    fieldsFor: (kind: Kind) => Object.freeze([
      ...baseFields,
      ...(readyKind(kind)?.fields ?? []),
    ]),
    filter: (id: string) => filterMap.get(id),
    sort: (id: string) => sortMap.get(id),
    filtersFor: (kind: Kind) => Object.freeze([
      ...defaults.filters,
      ...(readyKind(kind)?.filters ?? []),
    ]),
    sortsFor: (kind: Kind) => Object.freeze([
      ...defaults.sorts,
      ...(readyKind(kind)?.sorts ?? []),
    ]),
    chartsFor: (requestedKinds: readonly Kind[]) => Object.freeze(
      [...chartMap.values()].filter((chart) =>
        chart.kinds === "*" ||
        chart.kinds.some((kind) => requestedKinds.includes(kind))),
    ),
    viewsFor: (kind: Kind): readonly ViewModule[] => Object.freeze([
      ...(readyKind(kind)?.views ?? []),
    ]),
    tabs: () => tabs,
  });
}
