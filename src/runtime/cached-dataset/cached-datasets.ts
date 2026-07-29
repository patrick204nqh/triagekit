import type { Scope, TriageFailure } from "../catalog/types";
import type { Kind, TriageItem } from "../dataset/item";
import { createActionCatalog } from "../actions/catalog";
import type {
  ActionResult,
  TriageAction,
} from "../actions/types";
import type {
  BoundProvider,
  ProviderDefinition,
  ProviderConnectionStatus,
  SliceOutcome,
  SliceRequest,
} from "./provider";
import type {
  DatasetPersistence,
  PersistedSlice,
} from "./persistence";
import {
  createBrowserDatasetClock,
  DATASET_RETENTION_MS,
  DATASET_SOFT_BYTES,
  expiresAt,
  type DatasetClock,
} from "./clock";
import {
  createConnectionKey,
} from "./identity";
import type { ConnectionState } from "./browser-connection-state";
import type {
  CachedDatasets,
  ConnectedProvider,
  DatasetSession,
  DatasetSnapshot,
  DisconnectMode,
  RefreshCadence,
  RefreshReport,
  SliceFreshness,
  SliceState,
} from "./types";

const DEFAULT_SCHEMA = 1;
const OFF_FRESHNESS_SECONDS = 300;

export interface CachedDatasetOptions {
  readonly providers: readonly ProviderDefinition[];
  readonly persistence: DatasetPersistence;
  readonly connectionState: ConnectionState;
  readonly clock?: DatasetClock;
  readonly now?: () => number;
  readonly schema?: number;
}

interface RuntimeSlice {
  readonly target: string;
  readonly kind: Kind;
  persisted?: PersistedSlice;
  projectedItems?: readonly TriageItem[];
  freshness: SliceFreshness;
  failure?: TriageFailure;
}

interface ObservablePersistence extends DatasetPersistence {
  mode?(): "indexeddb" | "memory";
  warning?(): string | undefined;
}

const encoded = (target: string, kind: Kind): string =>
  JSON.stringify([target, kind]);

const deepFreezeCopy = <T>(value: T): T => {
  const copy = structuredClone(value);
  const seen = new WeakSet<object>();
  const freeze = (candidate: unknown): void => {
    if (candidate === null || typeof candidate !== "object" || seen.has(candidate)) return;
    seen.add(candidate);
    for (const nested of Object.values(candidate)) freeze(nested);
    Object.freeze(candidate);
  };
  freeze(copy);
  return copy;
};

const isTriageItem = (value: unknown): value is TriageItem => {
  if (value === null || typeof value !== "object") return false;
  const item = value as Partial<TriageItem>;
  return typeof item.id === "string"
    && typeof item.provider === "string"
    && typeof item.kind === "string"
    && typeof item.title === "string"
    && typeof item.location === "string"
    && typeof item.signal === "number"
    && Number.isFinite(item.signal)
    && typeof item.createdAt === "string"
    && typeof item.url === "string"
    && Object.prototype.hasOwnProperty.call(item, "providerRef")
    && Object.prototype.hasOwnProperty.call(item, "details");
};

const byteSize = (value: unknown): number =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength;

export const classifyFreshness = (input: {
  readonly validatedAt: number;
  readonly now: number;
  readonly cadence: RefreshCadence;
}): "fresh" | "stale" => {
  const seconds = input.cadence === "off"
    ? OFF_FRESHNESS_SECONDS
    : input.cadence;
  return input.now - input.validatedAt <= seconds * 1_000
    ? "fresh"
    : "stale";
};

const persistenceMode = (
  persistence: ObservablePersistence,
): "indexeddb" | "memory" =>
  persistence.mode?.() ?? "indexeddb";

const persistenceWarnings = (
  persistence: ObservablePersistence,
): readonly string[] => {
  const warning = persistence.warning?.();
  return warning ? Object.freeze([warning]) : Object.freeze([]);
};

const redactedFailure = (
  provider: string,
  kind: Kind,
  target: string,
  error: unknown,
  credential: string,
): TriageFailure => ({
  provider,
  kind,
  target,
  category: "provider",
  message: (() => {
    const message = error instanceof Error ? error.message : String(error);
    return credential.length > 0
      ? message.split(credential).join("[redacted]")
      : message;
  })(),
});

const createSession = (input: {
  readonly provider: string;
  readonly bound: BoundProvider;
  readonly scope: Scope;
  readonly kinds: readonly Kind[];
  readonly cadence: RefreshCadence;
  readonly credential: string;
  readonly persistence: ObservablePersistence;
  readonly connectionState: ConnectionState;
  readonly clock: DatasetClock;
  readonly schema: number;
  readonly activeConnectionKeys: Set<string>;
}): DatasetSession => {
  const observers = new Set<(snapshot: DatasetSnapshot) => void>();
  const actionCatalog = createActionCatalog(input.bound.actions ?? []);
  const pendingActions = new Set<string>();
  const actionControllers = new Set<AbortController>();
  const slices = new Map<string, RuntimeSlice>();
  const targets = input.bound.targets(input.scope);
  let cadence = input.cadence;
  let phase: DatasetSnapshot["phase"] = "hydrating";
  let generation = 0;
  let connectionKey: string | undefined;
  let closed = false;
  let activeAbort: AbortController | undefined;
  let cadenceTimer: unknown;
  let providerStatus: ProviderConnectionStatus =
    input.bound.status?.() ?? { paused: false };
  let statusUnsubscribe: (() => void) | undefined;
  let hydrationComplete = false;

  for (const target of targets) {
    for (const kind of input.kinds) {
      slices.set(encoded(target, kind), {
        target,
        kind,
        freshness: "requires-refresh",
      });
    }
  }

  const currentSnapshot = (): DatasetSnapshot => {
    const sliceStates: SliceState[] = [];
    const items: TriageItem[] = [];
    for (const slice of slices.values()) {
      if (slice.projectedItems) items.push(...slice.projectedItems);
      else if (slice.persisted) items.push(...slice.persisted.items);
      sliceStates.push(deepFreezeCopy({
        target: slice.target,
        kind: slice.kind,
        freshness: slice.freshness,
        ...(slice.persisted ? { validatedAt: slice.persisted.validatedAt } : {}),
        ...(slice.failure ? { failure: slice.failure } : {}),
      }));
    }
    return deepFreezeCopy({
      phase,
      provider: input.provider,
      scope: input.scope,
      cadence,
      items,
      slices: sliceStates,
      persistence: persistenceMode(input.persistence),
      warnings: persistenceWarnings(input.persistence),
      ...(providerStatus.paused && providerStatus.retryAt !== undefined
        ? { retryAt: providerStatus.retryAt }
        : {}),
      ...(pendingActions.size > 0
        ? { pendingActions: [...pendingActions] }
        : {}),
    });
  };

  let snapshot = currentSnapshot();
  const publish = (): void => {
    snapshot = currentSnapshot();
    for (const observer of observers) observer(snapshot);
  };

  type RefreshSelection = {
    targets?: readonly string[];
    kinds?: readonly Kind[];
  };
  type RefreshCause = "startup" | "manual" | "cadence";

  const selectedSlices = (selection?: RefreshSelection): RuntimeSlice[] => {
    const selectedTargets = selection?.targets
      ? new Set(selection.targets)
      : undefined;
    const selectedKinds = selection?.kinds
      ? new Set(selection.kinds)
      : undefined;
    return [...slices.values()].filter((slice) =>
      (!selectedTargets || selectedTargets.has(slice.target))
      && (!selectedKinds || selectedKinds.has(slice.kind)));
  };

  let initialized: Promise<void>;

  const clearCadenceTimer = (): void => {
    if (cadenceTimer === undefined) return;
    input.clock.clearInterval(cadenceTimer);
    cadenceTimer = undefined;
  };

  const scheduleCadenceTimer = (): void => {
    clearCadenceTimer();
    if (cadence === "off" || closed) return;
    cadenceTimer = input.clock.setInterval(() => {
      void refreshWithCause(undefined, "cadence");
    }, cadence * 1_000);
  };

  const prune = async (): Promise<void> => {
    if (!connectionKey) return;
    const now = input.clock.now();
    await input.persistence.prune({
      now,
      expiresBefore: now - DATASET_RETENTION_MS,
      softBytes: DATASET_SOFT_BYTES,
      activeConnectionKeys: input.activeConnectionKeys,
    });
  };

  const refreshWithCause = async (
    selection: RefreshSelection | undefined,
    cause: RefreshCause,
  ): Promise<RefreshReport> => {
    await initialized;
    providerStatus = input.bound.status?.() ?? providerStatus;
    if (providerStatus.paused) {
      phase = "paused";
      publish();
      return deepFreezeCopy({
        status: "paused",
        refreshed: [],
        retainedStale: [],
        failures: [],
        ...(providerStatus.retryAt !== undefined
          ? { retryAt: providerStatus.retryAt }
          : {}),
      });
    }
    if (closed || connectionKey === undefined) {
      return deepFreezeCopy({
        status: "paused",
        refreshed: [],
        retainedStale: [],
        failures: [],
      });
    }

    const selected = selectedSlices(selection).filter((slice) =>
      cause !== "cadence" || slice.failure?.category !== "scope");
    if (selected.length === 0) {
      return deepFreezeCopy({
        status: phase === "partial" ? "partial" : "complete",
        refreshed: [],
        retainedStale: [],
        failures: [],
      });
    }

    generation += 1;
    const refreshGeneration = generation;
    activeAbort?.abort(new DOMException("Superseded", "AbortError"));
    const abort = new AbortController();
    activeAbort = abort;
    await input.persistence.activateGeneration(connectionKey, refreshGeneration);
    if (refreshGeneration !== generation || closed) {
      return deepFreezeCopy({
        status: "superseded",
        refreshed: [],
        retainedStale: [],
        failures: [],
      });
    }

    for (const slice of selected) {
      slice.freshness = "refreshing";
      delete slice.failure;
    }
    phase = "refreshing";
    publish();

    const requests: SliceRequest[] = selected.map((slice) => ({
      target: slice.target,
      kind: slice.kind,
      ...(slice.persisted?.validator
        ? { validator: slice.persisted.validator }
        : {}),
    }));
    const refreshed: { target: string; kind: Kind }[] = [];
    const retainedStale: { target: string; kind: Kind }[] = [];
    const failures: TriageFailure[] = [];

    const failSlice = (
      slice: RuntimeSlice | undefined,
      failure: TriageFailure,
    ): void => {
      if (!slice) return;
      slice.failure = deepFreezeCopy(failure);
      slice.freshness = "failed";
      retainedStale.push({ target: slice.target, kind: slice.kind });
      failures.push(slice.failure);
    };

    try {
      for await (const outcome of input.bound.fetchSlices({
        scope: input.scope,
        slices: requests,
        signal: abort.signal,
      })) {
        if (refreshGeneration !== generation || closed) {
          return deepFreezeCopy({
            status: "superseded",
            refreshed,
            retainedStale,
            failures,
          });
        }
        const slice = slices.get(encoded(outcome.target, outcome.kind));
        if (!slice) continue;

        if (outcome.type === "failed") {
          failSlice(slice, outcome.failure);
          continue;
        }

        if (outcome.type === "unchanged") {
          if (!slice.persisted) {
            failSlice(slice, {
              provider: input.provider,
              kind: slice.kind,
              target: slice.target,
              category: "provider",
              message: "Provider returned unchanged without a cached Dataset Slice",
            });
            continue;
          }
          const validatedAt = input.clock.now();
          await input.persistence.touch(
            slice.persisted.key,
            validatedAt,
            outcome.validator,
          );
          slice.persisted = deepFreezeCopy({
            ...slice.persisted,
            validatedAt,
            lastAccessedAt: validatedAt,
            validator: outcome.validator,
          });
          slice.freshness = "fresh";
          refreshed.push({ target: slice.target, kind: slice.kind });
          publish();
          continue;
        }

        const validItems = outcome.items.every((item) =>
          isTriageItem(item)
          && item.provider === input.provider
          && item.kind === outcome.kind);
        if (!validItems) {
          failSlice(slice, {
            provider: input.provider,
            kind: slice.kind,
            target: slice.target,
            category: "provider",
            message: "Provider returned an invalid normalized TriageItem",
          });
          continue;
        }
        const validatedAt = input.clock.now();
        const persisted: PersistedSlice = deepFreezeCopy({
          key: {
            connectionKey,
            target: slice.target,
            kind: slice.kind,
          },
          schema: input.schema,
          items: outcome.items,
          validatedAt,
          lastAccessedAt: validatedAt,
          ...(outcome.validator ? { validator: outcome.validator } : {}),
          bytes: byteSize(outcome.items),
        });
        const result = await input.persistence.commit(
          persisted,
          refreshGeneration,
        );
        if (result === "superseded" || refreshGeneration !== generation) {
          return deepFreezeCopy({
            status: "superseded",
            refreshed,
            retainedStale,
            failures,
          });
        }
        slice.persisted = persisted;
        delete slice.projectedItems;
        slice.freshness = "fresh";
        delete slice.failure;
        refreshed.push({ target: slice.target, kind: slice.kind });
        publish();
      }
    } catch (error) {
      if (refreshGeneration !== generation || abort.signal.aborted || closed) {
        return deepFreezeCopy({
          status: "superseded",
          refreshed,
          retainedStale,
          failures,
        });
      }
      for (const slice of selected) {
        if (slice.freshness !== "refreshing") continue;
        failSlice(
          slice,
          redactedFailure(
            input.provider,
            slice.kind,
            slice.target,
            error,
            input.credential,
          ),
        );
      }
    }

    for (const slice of selected) {
      if (slice.freshness !== "refreshing") continue;
      failSlice(slice, {
        provider: input.provider,
        kind: slice.kind,
        target: slice.target,
        category: "provider",
        message: "Provider returned no outcome for the Dataset Slice",
      });
    }
    await prune();
    phase = failures.length > 0 ? "partial" : "ready";
    publish();
    return deepFreezeCopy({
      status: failures.length > 0 ? "partial" : "complete",
      refreshed,
      retainedStale,
      failures,
    });
  };

  const refresh = (selection?: RefreshSelection): Promise<RefreshReport> =>
    refreshWithCause(selection, "manual");

  const perform = async (
    action: TriageAction,
    signal?: AbortSignal,
  ): Promise<ActionResult> => {
    await initialized;
    if (closed) {
      return deepFreezeCopy({
        status: "rejected",
        message: "Dataset Session is closed",
      });
    }
    const item = snapshot.items.find(({ id }) => id === action.itemId);
    if (!item) {
      return deepFreezeCopy({
        status: "rejected",
        message: `Triage item "${action.itemId}" was not found`,
      });
    }
    const definition = actionCatalog.definition(action.intent);
    if (!definition
      || !definition.kinds.includes(item.kind)
      || !definition.available(item)) {
      return deepFreezeCopy({
        status: "rejected",
        message: `Triage Action "${action.intent}" is not available`,
      });
    }
    const errors = definition.validate(action);
    if (errors.length > 0) {
      return deepFreezeCopy({
        status: "rejected",
        message: errors.join("; "),
      });
    }
    if (pendingActions.has(action.itemId)) {
      return deepFreezeCopy({
        status: "rejected",
        message: "A Triage Action is already pending for this item",
      });
    }

    const controller = new AbortController();
    const abort = (): void =>
      controller.abort(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
    actionControllers.add(controller);
    pendingActions.add(action.itemId);
    publish();

    try {
      let result: ActionResult;
      try {
        result = await definition.execute(action, item, controller.signal);
      } catch (error) {
        if (controller.signal.aborted) throw controller.signal.reason ?? error;
        result = {
          status: "rejected",
          message: error instanceof Error ? error.message : String(error),
        };
      }

      if (result.status === "confirmed" && result.item) {
        const projected = result.item;
        if (projected.id !== item.id
          || projected.provider !== input.provider
          || projected.kind !== item.kind
          || !isTriageItem(projected)) {
          result = {
            status: "rejected",
            message: "Provider returned an invalid normalized TriageItem",
          };
        } else {
          const slice = [...slices.values()].find((candidate) =>
            (candidate.projectedItems ?? candidate.persisted?.items ?? [])
              .some(({ id }) => id === item.id));
          if (slice) {
            const currentItems = slice.projectedItems
              ?? slice.persisted?.items
              ?? [];
            slice.projectedItems = deepFreezeCopy(
              currentItems.map((current) =>
                current.id === item.id ? projected : current),
            );
            publish();
          }
        }
      }

      if (result.status === "confirmed"
        || result.status === "outcome-unknown") {
        await refresh(definition.revalidate(action, item));
      }
      return deepFreezeCopy(result);
    } finally {
      signal?.removeEventListener("abort", abort);
      actionControllers.delete(controller);
      pendingActions.delete(action.itemId);
      publish();
    }
  };

  initialized = (async () => {
    connectionKey = await createConnectionKey(
      input.provider,
      input.credential,
      input.scope,
    );
    input.activeConnectionKeys.add(connectionKey);
    await input.persistence.activateGeneration(connectionKey, generation);
    const hydrated = await input.persistence.hydrate(connectionKey);
    if (closed) return;
    for (const persisted of hydrated) {
      const slice = slices.get(encoded(
        persisted.key.target,
        persisted.key.kind,
      ));
      if (!slice
        || persisted.schema !== input.schema
        || expiresAt(persisted.validatedAt) <= input.clock.now()
        || !persisted.items.every((item) =>
          isTriageItem(item)
          && item.provider === input.provider
          && item.kind === slice.kind)) {
        continue;
      }
      slice.persisted = deepFreezeCopy(persisted);
      slice.freshness = classifyFreshness({
        validatedAt: persisted.validatedAt,
        now: input.clock.now(),
        cadence,
      });
    }
    await prune();
    hydrationComplete = true;
    phase = providerStatus.paused ? "paused" : "ready";
    publish();
    const due = [...slices.values()].filter((slice) =>
      slice.freshness !== "fresh");
    if (due.length > 0 && !providerStatus.paused) {
      queueMicrotask(() => {
        void refreshWithCause({
          targets: [...new Set(due.map((slice) => slice.target))],
          kinds: [...new Set(due.map((slice) => slice.kind))],
        }, "startup");
      });
    }
  })();
  statusUnsubscribe = input.bound.subscribeStatus?.((status) => {
    providerStatus = status;
    if (status.paused) {
      phase = "paused";
    } else if (hydrationComplete && phase === "paused") {
      phase = [...slices.values()].some((slice) => slice.failure)
        ? "partial"
        : "ready";
    }
    publish();
  });
  scheduleCadenceTimer();

  return {
    snapshot: () => snapshot,
    subscribe(observer) {
      observers.add(observer);
      observer(snapshot);
      return () => observers.delete(observer);
    },
    refresh,
    available(item) {
      return actionCatalog.forItem(item);
    },
    perform,
    setCadence(nextCadence) {
      cadence = nextCadence;
      input.connectionState.saveCadence(input.provider, nextCadence);
      scheduleCadenceTimer();
      for (const slice of slices.values()) {
        if (!slice.persisted || slice.freshness === "refreshing") continue;
        slice.freshness = classifyFreshness({
          validatedAt: slice.persisted.validatedAt,
          now: input.clock.now(),
          cadence,
        });
      }
      publish();
    },
    async clearCachedData() {
      await initialized;
      if (connectionKey) await input.persistence.removeConnection(connectionKey);
      for (const slice of slices.values()) {
        delete slice.persisted;
        delete slice.projectedItems;
        delete slice.failure;
        slice.freshness = "requires-refresh";
      }
      phase = "ready";
      publish();
    },
    async disconnect(mode: DisconnectMode) {
      await initialized;
      closed = true;
      generation += 1;
      activeAbort?.abort(new DOMException("Disconnected", "AbortError"));
      for (const controller of actionControllers) {
        controller.abort(new DOMException("Disconnected", "AbortError"));
      }
      clearCadenceTimer();
      statusUnsubscribe?.();
      if (mode === "erase" && connectionKey) {
        await input.persistence.removeConnection(connectionKey);
      }
      if (connectionKey) input.activeConnectionKeys.delete(connectionKey);
      input.bound.close();
      input.connectionState.disconnect(input.provider, mode);
      phase = "closed";
      publish();
      observers.clear();
    },
  };
};

export const createCachedDatasets = (
  options: CachedDatasetOptions,
): CachedDatasets => {
  const providers = new Map(options.providers.map((provider) => [
    provider.id,
    provider,
  ]));
  const persistence = options.persistence as ObservablePersistence;
  const defaultClock = createBrowserDatasetClock();
  const clock = options.clock ?? (
    options.now
      ? { ...defaultClock, now: options.now }
      : defaultClock
  );
  const schema = options.schema ?? DEFAULT_SCHEMA;
  const activeConnectionKeys = new Set<string>();

  const bind = async (
    providerId: string,
    credential: string,
    resuming = false,
  ): Promise<ConnectedProvider> => {
    const definition = providers.get(providerId);
    if (!definition) throw new Error(`Unknown provider "${providerId}"`);
    const trimmed = credential.trim();
    const bound = await definition.bind(trimmed);
    return {
      discoverScope: (signal) => bound.discoverScope(signal),
      open(openInput) {
        const requestedScope = resuming
          && Object.keys(openInput.scope).length === 0
          ? options.connectionState.scope(providerId)
          : openInput.scope;
        const requestedCadence = resuming && openInput.cadence === "off"
          ? options.connectionState.cadence(providerId)
          : openInput.cadence;
        const scope = bound.canonicalizeScope(requestedScope);
        options.connectionState.saveScope(providerId, scope);
        options.connectionState.saveCadence(providerId, requestedCadence);
        return createSession({
          provider: providerId,
          bound,
          scope,
          kinds: Object.freeze([...new Set(openInput.kinds)]),
          cadence: requestedCadence,
          credential: trimmed,
          persistence,
          connectionState: options.connectionState,
          clock,
          schema,
          activeConnectionKeys,
        });
      },
    };
  };

  return {
    async connect(provider, credential) {
      const connected = await bind(provider, credential);
      options.connectionState.saveCredential(provider, credential);
      return connected;
    },
    async resume(provider) {
      const credential = options.connectionState.credential(provider);
      return credential ? bind(provider, credential, true) : null;
    },
  };
};
