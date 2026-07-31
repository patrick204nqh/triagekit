import { CatalogError } from "../core/errors.js";
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

function immutableSnapshot<T>(
  value: T,
  seen = new WeakMap<object, unknown>(),
): T {
  if (value === null || typeof value !== "object") return value;
  const existing = seen.get(value);
  if (existing) return existing as T;

  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    seen.set(value, copy);
    copy.push(...value.map((entry) => immutableSnapshot(entry, seen)));
    return Object.freeze(copy) as T;
  }

  const copy = Object.create(Object.getPrototypeOf(value)) as Record<
    PropertyKey,
    unknown
  >;
  seen.set(value, copy);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if ("value" in descriptor) {
      descriptor.value = immutableSnapshot(descriptor.value, seen);
    }
    Object.defineProperty(copy, key, descriptor);
  }
  return Object.freeze(copy) as T;
}

function addUnique<T extends { id: string }>(
  map: Map<string, T>,
  value: T,
  noun: string,
): void {
  const existing = map.get(value.id);
  if (existing && existing !== value) {
      throw new CatalogError(`duplicate ${noun} identifier: ${value.id}`);
  }
  map.set(value.id, value);
}

function validateReadyKind(kind: ReadyKindDeclaration): void {
  const requiredCollections = [
    "fields",
    "filters",
    "sorts",
    "charts",
    "views",
  ] as const;
  for (const property of requiredCollections) {
    if (!Array.isArray(kind[property])) {
      throw new CatalogError(
        `kind "${kind.kind}": missing required ${property}`,
      );
    }
  }
  if (typeof kind.builtInScorer !== "function") {
    throw new CatalogError(
      `kind "${kind.kind}": missing required builtInScorer`,
    );
  }
  if (typeof kind.explainBuiltInScore !== "function") {
    throw new CatalogError(
      `kind "${kind.kind}": missing required explainBuiltInScore`,
    );
  }
  if (!kind.renderer || typeof kind.renderer !== "object") {
    throw new CatalogError(
      `kind "${kind.kind}": missing required renderer`,
    );
  }
  if (kind.renderer.kind !== kind.kind) {
    throw new CatalogError(
      `kind "${kind.kind}": renderer declares "${kind.renderer.kind}"`,
    );
  }
  if (!Array.isArray(kind.renderer.columns)
    || kind.renderer.columns.length === 0) {
    throw new CatalogError(
      `kind "${kind.kind}": renderer must declare at least one column`,
    );
  }

  const views = new Set<string>();
  for (const view of kind.views) {
    if (view.kind !== kind.kind) {
      throw new CatalogError(
        `kind "${kind.kind}": view "${view.id}" declares "${view.kind}"`,
      );
    }
    if (views.has(view.id)) {
      throw new CatalogError(
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
  const supported = new Set(provider.kinds);
  for (const kind of provider.kinds) {
    if (!kinds.has(kind)) {
      throw new CatalogError(
        `provider "${provider.id}" references kind "${kind}" that is unregistered`,
      );
    }
  }
  for (const kind of provider.capabilities.enrich) {
    if (!supported.has(kind)) {
      throw new CatalogError(
        `provider "${provider.id}" enrichment references unsupported kind "${kind}"`,
      );
    }
  }
  for (const kind of Object.keys(provider.capabilities.actions) as Kind[]) {
    if (!supported.has(kind)) {
      throw new CatalogError(
        `provider "${provider.id}" actions reference unsupported kind "${kind}"`,
      );
    }
  }
}

export function createRuntimeCatalog(
  input: RuntimeCatalogInput,
): RuntimeCatalog {
  const kindMap = new Map<Kind, KindDeclaration>();
  for (const candidate of input.kinds) {
    const kind = immutableSnapshot(candidate);
    if (kindMap.has(kind.kind)) {
      throw new CatalogError(`duplicate kind identifier: ${kind.kind}`);
    }
    if (kind.status === "ready") validateReadyKind(kind);
    kindMap.set(kind.kind, kind);
  }

  const providerMap = new Map<string, ProviderDeclaration>();
  for (const candidate of input.providers) {
    const provider = immutableSnapshot(candidate);
    if (providerMap.has(provider.id)) {
      throw new CatalogError(`duplicate provider identifier: ${provider.id}`);
    }
    validateProvider(provider, kindMap);
    providerMap.set(provider.id, provider);
  }

  const defaults: RuntimeDefaults = {
    filters: immutableSnapshot(
      input.defaults?.filters ?? EMPTY_DEFAULTS.filters,
    ),
    sorts: immutableSnapshot(
      input.defaults?.sorts ?? EMPTY_DEFAULTS.sorts,
    ),
    charts: immutableSnapshot(
      input.defaults?.charts ?? EMPTY_DEFAULTS.charts,
    ),
    tabs: immutableSnapshot(
      input.defaults?.tabs ?? EMPTY_DEFAULTS.tabs,
    ),
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
  const artifacts = immutableSnapshot(kinds.map((kind) => ({
    id: kind.kind,
    label: kind.label,
    group: getDomain(kind.domain).class,
    kinds: [kind.kind],
  })));
  const artifactMap = new Map(
    artifacts.map((artifact) => [artifact.id as Kind, artifact]),
  );
  const tabs = defaults.tabs;

  const readyKind = (id: Kind): ReadyKindDeclaration | undefined => {
    const declaration = kindMap.get(id);
    return declaration?.status === "ready" ? declaration : undefined;
  };

  return Object.freeze({
    kind: (id: Kind) => kindMap.get(id),
    readyKind,
    insightsFor: (kind: Kind) => readyKind(kind)?.insights,
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
