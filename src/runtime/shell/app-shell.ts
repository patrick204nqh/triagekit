import type { TriageConfigT } from "../../config/schema";
import { isCompiledConfig } from "./mode";
import type {
  ProviderDeclaration,
  RuntimeCatalog,
  Scorer,
  Scope,
} from "../catalog/types";
import { GROUP_LABEL, GROUP_ORDER, type Artifact } from "../dataset/artifact";
import { explainScoreModel, validateModel, type ScoreExplanation } from "../scoring/score-model";
import { renderTableSkeleton } from "../layout/table/triage-table";
import { esc } from "../layout/util";
import type { ScoredItem } from "../layout/table/kind-renderer";
import { renderInsights } from "../layout/insights";
import type { ListState } from "../layout/toolbar/filter-state";
import { renderToolbar, type ToolbarProps } from "../layout/toolbar/toolbar";
import { PolicyStore } from "./policy-store";
import { scopeSummary } from "./health";
import { mountSettings } from "./settings";
import { providerIcon } from "./provider-icons";
import { getThemeChoice, cycleTheme } from "./theme";
import {
  connectionDatasetState,
  mountConnectionStatus,
} from "./connection-status";
import { adapterBotLogins } from "../core/author-policy";
import type { ViewPort } from "../core/ports";
import type { CoreDeps, Core } from "../core/core";
import type { DomViewDeps } from "../adapters/dom-view";
import {
  createBrowserSessionUrl,
  type SessionUrlAdapter,
} from "../adapters/browser-session-url";
import { createTriageSession } from "../session/triage-session";
import type { SessionUpdate, TriageSession } from "../session/types";
import { HandoffController } from "../handoff/controller";
import { buildInsightSnapshot } from "../insights/projector";
import { resolveInsightRoute } from "../insights/routes";
import type { InsightSnapshot } from "../insights/types";
import type { Kind } from "../dataset/item";
import type { TriageFailure } from "../catalog/types";
import type {
  CachedDatasets,
  ConnectedProvider,
  DatasetSession,
  DatasetSnapshot,
  RefreshCadence,
} from "../cached-dataset/types";
import { createBrowserConnectionState } from "../cached-dataset/browser-connection-state";
import type { FocusPolicySnapshot } from "../focus/types";
import {
  migrateLegacyLabels,
  reconcileRepositoryOrder,
} from "../focus/policy";
import { createBrowserQueueStore } from "../delegation/browser-queue-store";
import {
  createDelegationQueue,
  queueKey,
} from "../delegation/queue";
import {
  queueIdentityForItem,
  type RowDelegationSelection,
  type SelectionControlsProps,
} from "../layout/delegation/selection-controls";
import {
  createDelegationController,
} from "../delegation/controller";
import type {
  DelegationController,
  RevalidationResult,
} from "../delegation/types";
import {
  revalidateQueue as revalidateDelegationQueue,
} from "../delegation/revalidation";
import { projectDelegationTarget } from "../delegation/projector";
import {
  downloadJson,
  downloadText,
} from "../handoff/adapters/download";
import { mountDelegationComposer } from "../layout/delegation/composer";
import type { Tier } from "../scoring/tier";

export interface ShellEnv {
  catalog: RuntimeCatalog;
  datasets: CachedDatasets;
  session?: TriageSession;
  sessionUrl?: SessionUrlAdapter;
  createCore: (deps: CoreDeps) => Core;
  createDomView: (host: HTMLElement, deps: DomViewDeps) => ViewPort;
  scoreOverride?: Scorer;
}

export type ShellCore = Core & { readonly ready: Promise<void> };

const applicableCatalogTabs = (
  catalog: RuntimeCatalog,
  artifact: Artifact,
  rows: ScoredItem[],
) =>
  catalog.tabs()
    .filter((tab) => tab.appliesTo(artifact, rows))
    .sort((a, b) => a.order - b.order);

// Product mark: a funnel (many signals in → a triaged few out) whose drip is the
// teal accent, echoing the "·" in the wordmark.
const BRAND_MARK = `<svg class="brand-mark" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3.5 5.5H20.5L13 14.5V18H11V14.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="20.8" r="1.7" fill="var(--accent)"/></svg>`;
const SUN = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`;
const MOON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
const GEAR = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
// "Auto" theme = follow the OS; its icon is a monitor, distinct from sun/moon.
const AUTO = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`;
const REFRESH = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>`;

export interface ToolbarPropsInput {
  artifact: Artifact; rows: ScoredItem[]; filters: ListState;
  hasInsights: boolean; activeView: string;
  providers: { id: string; provider: string; status: string }[];
  activeProvider: string;
  activeRepo: string;
  extraTabs: { id: string; label: string }[];
  focusPolicy: FocusPolicySnapshot;
}

// Pure assembly of the toolbar's view-mode / provider-scope / filter props from the
// shell's state, extracted so it's testable without mounting the whole shell.
function assembleToolbarProps(i: ToolbarPropsInput): Omit<
  ToolbarProps,
  | "onFilterChange"
  | "onLabelRulesChange"
  | "onViewChange"
  | "onProviderSelect"
  | "onRepoSelect"
> {
  const viewModes = [{ id: "list", label: "List" }];
  if (i.hasInsights) viewModes.push({ id: "insights", label: "Insights" });
  for (const t of i.extraTabs) viewModes.push({ id: t.id, label: t.label });
  const providers = i.providers.map(s => ({
    id: s.id, label: s.provider, on: s.id === i.activeProvider, live: s.status === "ready",
  }));
  const activeRepositories = [...new Set(i.rows.map((row) => row.location))];
  const ordered = reconcileRepositoryOrder(
    i.focusPolicy.repositoryOrder,
    activeRepositories,
  ).active;
  const repos = ordered.map((location) => ({
    id: location,
    label: location,
  }));
  // Coerce the displayed active tab to "All" when the sticky repo isn't among the
  // current options — matches derive()'s auto-fallback. State is NOT reset upstream,
  // so stickiness survives a round-trip to an artifact that DOES have the repo.
  const activeRepo = repos.some(r => r.id === i.activeRepo) ? i.activeRepo : "";
  // The toolbar's filter options + count derive from `rows`; scope them to the active
  // repo so labels (and the count) are per-repo. The repo TABS, computed above from the
  // full set, still list every repo so the user can switch.
  const rows = activeRepo ? i.rows.filter(r => r.location === activeRepo) : i.rows;
  return {
    artifact: i.artifact,
    rows,
    filters: i.filters,
    focusPolicy: i.focusPolicy,
    viewModes,
    activeView: i.activeView,
    providers,
    repos,
    activeRepo,
  };
}

export function mountShell(config: TriageConfigT, env: ShellEnv): ShellCore {
  const catalog = env.catalog;
  const session = env.session ?? createTriageSession({ catalog });
  const sessionUrl = env.sessionUrl ?? createBrowserSessionUrl(window);
  const policy = new PolicyStore();
  const delegationQueue = createDelegationQueue(createBrowserQueueStore({
    get: (key) => sessionStorage.getItem(key),
    set: (key, value) => sessionStorage.setItem(key, value),
  }));
  const hasInsights = true;

  const providersForArtifact = (a: Artifact) =>
    catalog.providersFor(a.kinds[0]);
  const readyProvidersFor = (a: Artifact) => providersForArtifact(a).filter(s => s.status === "ready");
  const artifacts = catalog.artifacts().filter(a => providersForArtifact(a).length > 0);
  const primaryProvider = (a: Artifact): ProviderDeclaration =>
    readyProvidersFor(a)[0] ?? providersForArtifact(a)[0];

  const restoredSession = session.restore(sessionUrl.read()).state;
  const storedFocusPolicy = policy.getFocusPolicy(restoredSession.provider);
  const migrated = migrateLegacyLabels(
    restoredSession.filters,
    storedFocusPolicy,
  );
  if (migrated.policy !== storedFocusPolicy) {
    policy.setFocusPolicy(migrated.policy);
  }
  const initialSession = session.changeFilters(migrated.listState).state;
  let active: Artifact = catalog.artifact(initialSession.kind)
    ?? artifacts.find((artifact) => readyProvidersFor(artifact).length)
    ?? artifacts[0];
  const currentView = () => session.snapshot().view;
  const currentProvider = () => session.snapshot().provider;
  const currentRepository = () => session.snapshot().effectiveRepository;
  const currentFilters = () => session.snapshot().filters;
  const currentFocusPolicy = (): FocusPolicySnapshot => {
    const provider = currentProvider();
    const policySnapshot = policy.getFocusPolicy(provider);
    const repositories = [...new Set(
      activeItems().map((item) => item.location),
    )];
    const reconciled = reconcileRepositoryOrder(
      policySnapshot.repositoryOrder,
      repositories,
    );
    if (
      reconciled.saved.length !== policySnapshot.repositoryOrder.length
      || reconciled.saved.some((repository, index) =>
        repository !== policySnapshot.repositoryOrder[index])
    ) {
      const next = {
        ...policySnapshot,
        repositoryOrder: reconciled.saved,
      };
      policy.setFocusPolicy(next);
      return next;
    }
    return policySnapshot;
  };
  let lastRows: ScoredItem[] = [];
  let lastShownRows: ScoredItem[] = [];
  let lastFetchedAt: number | null = null;
  let insightSnapshot: InsightSnapshot | null = null;
  let insightRefreshing = false;
  let delegationController: DelegationController | null = null;
  const connectedProviders = new Map<string, ConnectedProvider>();
  const datasetSessions = new Map<string, DatasetSession>();
  const datasetSnapshots = new Map<string, DatasetSnapshot>();
  const unsubscribers = new Map<string, () => void>();
  let coreReady = false;

  const activeDatasetSession = () => datasetSessions.get(currentProvider());
  const activeDatasetSnapshot = () => datasetSnapshots.get(currentProvider());
  const activeItems = () => activeDatasetSnapshot()?.items ?? [];
  const activeFailures = (): readonly TriageFailure[] =>
    activeDatasetSnapshot()?.slices
      .flatMap((slice) => slice.failure ? [slice.failure] : []) ?? [];
  const actionPort = {
    available: (item: ScoredItem) =>
      activeDatasetSession()?.available(item) ?? [],
    perform: async (action: Parameters<DatasetSession["perform"]>[0]) =>
      activeDatasetSession()?.perform(action)
      ?? {
        status: "rejected" as const,
        message: "Provider Connection is unavailable",
      },
    status: () => ({
      paused: activeDatasetSnapshot()?.phase === "paused",
      ...(activeDatasetSnapshot()?.retryAt !== undefined
        ? { retryAt: activeDatasetSnapshot()?.retryAt }
        : {}),
    }),
  };
  const selectedQueueKeys = () => new Set(
    delegationQueue.snapshot().entries
      .filter((entry) => entry.selected)
      .map((entry) => queueKey(entry.identity)),
  );
  const toggleQueueItem = (item: ScoredItem) => {
    const identity = queueIdentityForItem(item);
    const key = queueKey(identity);
    const existing = delegationQueue.snapshot().entries.find((entry) =>
      queueKey(entry.identity) === key);
    if (existing) delegationQueue.setSelected(key, !existing.selected);
    else delegationQueue.add(identity, Date.now());
  };
  const rowDelegationSelection = (): RowDelegationSelection => ({
    queuedKeys: selectedQueueKeys(),
    onToggle: toggleQueueItem,
  });
  const delegationSelectionControls = (): SelectionControlsProps => {
    const snapshot = delegationQueue.snapshot();
    return {
      visible: lastShownRows,
      queuedKeys: selectedQueueKeys(),
      selectedCount: snapshot.selectedCount,
      totalCount: snapshot.entries.length,
      onAddVisible: (rows) => {
        delegationQueue.addMany(
          rows.map(queueIdentityForItem),
          Date.now(),
        );
      },
      onOpenQueue: () => {
        delegationController?.open();
        queueMicrotask(() => {
          void delegationController?.revalidate();
        });
      },
    };
  };

  // Signature of the toolbar's row-derived inputs (distinct repo locations + applicable
  // extra-tab ids for the active artifact). dispatchView rebuilds the toolbar only when
  // this changes, so post-fetch data surfaces new repo tabs without rebuilding (and
  // closing open popovers) on every render. buildNav() refreshes it after each build.
  // Deliberately omits repo counts: a silent refresh that only reorders the (unchanged)
  // location set won't rebuild — tolerating cosmetic tab-order lag to keep popovers open.
  const navRowSig = () =>
    [...new Set(lastRows.map(r => r.location))].sort().join(",") +
    "|" + applicableCatalogTabs(catalog, active, lastRows).map(t => t.id).sort().join(",");
  let lastNavRowSig = "";

  // Per-item score breakdown for the list drawer (lifted from renderListWithFilters).
  const scoreExplain = (i: ScoredItem): ScoreExplanation | null => {
    const m = policy.getScoreModel(i.kind);
    if (!m || validateModel(m, catalog.fieldsFor(i.kind)).length !== 0) return null;
    try { return explainScoreModel(m, i); } catch { return null; }
  };

  // Filter change: update state, re-derive from the store (no refetch).
  const onFilterChange = (next: ListState) => {
    applySessionUpdate(session.changeFilters(next));
  };

  // Dispatcher view: owns view-mode selection (mirrors the original post-fetch
  // branching). insights/tab render directly; list mode delegates to the DOM view.
  const dispatchView: ViewPort = {
    render(vm) {
      lastRows = vm.scored;
      lastShownRows = vm.shown;
      lastFetchedAt = activeDatasetSnapshot()?.slices.reduce<number | null>(
        (latest, slice) => slice.validatedAt !== undefined
          ? Math.max(latest ?? 0, slice.validatedAt)
          : latest,
        null,
      ) ?? null;
      refreshConnectionStatus();
      if (needsRepositoryScope()) {
        render();
        return;
      }
      const reconciliation = session.reconcile({
        repositories: [...new Set(vm.scored.map((row) => row.location))],
        views: [
          "list",
          ...(hasInsights ? ["insights"] : []),
          ...applicableCatalogTabs(catalog, active, vm.scored)
            .map((tab) => tab.id),
        ],
      });
      if (reconciliation.work !== "none") {
        sessionUrl.write(reconciliation.serialized);
        if (reconciliation.work === "rederive") {
          queueMicrotask(() => core.rerender());
        }
      }
      if (catalog.kind(active.id)?.status === "upcoming") {
        render();
        return;
      }
      if (!activeDatasetSession()) {
        render();
        return;
      }
      // The toolbar's repo tabs and applicable extra tabs are derived from the rows,
      // which are empty at the initial buildNav() and only arrive here post-fetch.
      // Rebuild the toolbar when that row-derived set actually changes — but not on
      // every paint, so a background refresh doesn't tear down an open filter popover.
      if (navRowSig() !== lastNavRowSig) buildNav();
      if (currentView() === "insights") { void presentInsights(false); return; }
      if (currentView() !== "list") {
        const tab = catalog.tabs().find((candidate) => candidate.id === currentView());
        if (tab) { tab.render(root, vm.scored); return; }
      }
      env.createDomView(root, {
        artifact: active,
        scoreExplain,
        catalog: catalog,
        handoffController,
        actions: actionPort,
        delegationSelection: rowDelegationSelection(),
      }).render(vm);
    },
  };

  const scoreContext = () => ({
    getModel: (kind: Kind) => policy.getScoreModel(kind),
    getFields: (kind: Kind) => catalog.fieldsFor(kind),
    getThresholds: () => policy.getTiers(),
    override: env.scoreOverride,
  });

  const core = env.createCore({
    items: activeItems,
    failures: activeFailures,
    refresh: async () => {
      await activeDatasetSession()?.refresh();
    },
    view: dispatchView,
    activeKinds: () => active.kinds,
    botLogins: () => policy.getBotLogins(),
    scoreContext,
    filters: currentFilters,
    focusPolicy: currentFocusPolicy,
    repoView: currentRepository,
  });
  delegationQueue.subscribe(() => {
    if (!coreReady) return;
    buildNav();
    if (currentView() === "list") core.rerender();
  });

  const scoreQueuedItem = (item: DatasetSnapshot["items"][number]): ScoredItem =>
    lastRows.find((row) => row.id === item.id) ?? {
      ...item,
      score: item.signal,
      tier: "P3" as Tier,
    };

  const revalidateSelectedQueue = async (): Promise<RevalidationResult> => {
    const selected = delegationQueue
      .snapshot()
      .entries.filter((entry) => entry.selected);
    const transitions: RevalidationResult["transitions"][number][] = [];

    for (const provider of [
      ...new Set(selected.map((entry) => entry.identity.provider)),
    ]) {
      const entries = selected.filter(
        (entry) => entry.identity.provider === provider,
      );
      const before = datasetSnapshots.get(provider);
      const session = datasetSessions.get(provider) ?? null;

      if (!before) {
        transitions.push(
          ...entries.map((entry) => ({
            key: queueKey(entry.identity),
            itemId: entry.identity.itemId,
            status: "unavailable" as const,
            selected: true,
            reason: "Provider dataset unavailable",
          })),
        );
        continue;
      }

      const result = await revalidateDelegationQueue({
        entries,
        before,
        session,
        project: (item) =>
          projectDelegationTarget({
            item: scoreQueuedItem(item),
            explanation: scoreExplain(scoreQueuedItem(item)),
            catalog,
          }),
      });
      transitions.push(...result.transitions);
    }

    return { transitions };
  };

  delegationController = createDelegationController({
    queue: delegationQueue,
    items: () =>
      [...datasetSnapshots.values()].flatMap((snapshot) =>
        snapshot.items.map(scoreQueuedItem),
      ),
    focusPolicy: currentFocusPolicy,
    catalog,
    scoreExplain,
    clipboard: {
      writeText: (text) => navigator.clipboard.writeText(text),
    },
    downloads: {
      text: downloadText,
      json: downloadJson,
    },
    revalidateQueue: revalidateSelectedQueue,
  });

  let delegationHost = document.getElementById("delegation-host");
  if (!delegationHost) {
    delegationHost = document.createElement("div");
    delegationHost.id = "delegation-host";
    document.body.append(delegationHost);
  }
  mountDelegationComposer(delegationHost, delegationController);

  function applySessionUpdate(update: SessionUpdate): void {
    active = catalog.artifact(update.state.kind) ?? active;
    sessionUrl.write(update.serialized);

    if (update.work === "refresh") {
      lastRows = [];
      lastShownRows = [];
      lastFetchedAt = null;
      buildRail();
      buildNav();
      refreshConnectionStatus();
      void core.refreshNow();
    } else if (update.work === "rederive") {
      core.rerender();
      buildNav();
    } else if (update.work === "present") {
      buildRail();
      buildNav();
      refreshConnectionStatus();
      if (update.state.view === "insights" || catalog.kind(update.state.kind)?.status === "upcoming") {
        render();
      } else {
        core.rerender();
      }
    }
  }

  // ── Command bar: brand + connection status + refresh + theme ──
  const bar = document.getElementById("appbar")!;
  const titleHtml = esc(config.branding.title).replace(/·/g, `<span class="dot">·</span>`);
  bar.innerHTML = `<h1 class="brand">${BRAND_MARK}<span class="wordmark">${titleHtml}</span></h1><div class="spacer"></div>`;
  const statusHost = document.createElement("div");
  const refresh = document.createElement("button"); refresh.className = "icon-btn"; refresh.setAttribute("aria-label", "Refresh now"); refresh.title = "Refresh now"; refresh.innerHTML = REFRESH;
  const themeBtn = document.createElement("button"); themeBtn.className = "icon-btn"; themeBtn.setAttribute("aria-label", "Toggle theme");
  const gear = document.createElement("button"); gear.className = "icon-btn"; gear.setAttribute("aria-label", "Settings"); gear.title = "Settings"; gear.innerHTML = GEAR;
  bar.append(statusHost, refresh, themeBtn, gear);

  const pendingConnections = new Map<string, ConnectedProvider>();
  const connectionState = createBrowserConnectionState();
  const configuredScope = (providerId: string): Scope => {
    const compiled = isCompiledConfig(config) && config.source === providerId
      ? config.scope ?? {}
      : {};
    return Object.keys(compiled).length > 0
      ? compiled
      : connectionState.scope(providerId);
  };

  const installDatasetSession = (
    providerId: string,
    connected: ConnectedProvider,
    scope: Scope,
    cadence: RefreshCadence,
  ): DatasetSession => {
    unsubscribers.get(providerId)?.();
    const provider = catalog.provider(providerId);
    const datasetSession = connected.open({
      scope,
      kinds: provider?.kinds ?? [],
      cadence,
    });
    connectedProviders.set(providerId, connected);
    datasetSessions.set(providerId, datasetSession);
    const unsubscribe = datasetSession.subscribe((snapshot) => {
      datasetSnapshots.set(providerId, snapshot);
      if (!coreReady) return;
      if (providerId === currentProvider()) {
        core.rerender();
        refreshConnectionStatus();
        if (currentView() === "insights") void presentInsights(false);
      }
    });
    unsubscribers.set(providerId, unsubscribe);
    return datasetSession;
  };

  const settingsHost = document.getElementById("settings-host")!;
  const settings = mountSettings(settingsHost, {
    catalog,
    providers: [...catalog.providers()],
    connections: {
      has: (providerId) =>
        datasetSnapshots.get(providerId)?.phase !== "closed"
        && connectedProviders.has(providerId),
      scope: (providerId) =>
        datasetSnapshots.get(providerId)?.scope ?? configuredScope(providerId),
      cadence: (providerId) =>
        datasetSnapshots.get(providerId)?.cadence ?? "off",
      async discover(providerId, credential) {
        const connected = credential
          ? await env.datasets.connect(providerId, credential)
          : connectedProviders.get(providerId)
            ?? await env.datasets.resume(providerId);
        if (!connected) throw new Error("Enter a credential before discovery");
        if (credential) pendingConnections.set(providerId, connected);
        return connected.discoverScope();
      },
      async save(providerId, credential, scope) {
        const cadence = datasetSnapshots.get(providerId)?.cadence ?? "off";
        const connected = credential
          ? pendingConnections.get(providerId)
            ?? await env.datasets.connect(providerId, credential)
          : connectedProviders.get(providerId)
            ?? await env.datasets.resume(providerId);
        if (!connected) throw new Error("Enter a credential before saving");
        pendingConnections.delete(providerId);
        installDatasetSession(providerId, connected, scope, cadence);
      },
      setCadence(providerId, cadence) {
        datasetSessions.get(providerId)?.setCadence(cadence);
      },
      async clearCachedData(providerId) {
        await datasetSessions.get(providerId)?.clearCachedData();
      },
      async disconnect(providerId, mode) {
        await datasetSessions.get(providerId)?.disconnect(mode);
        unsubscribers.get(providerId)?.();
        unsubscribers.delete(providerId);
        connectedProviders.delete(providerId);
        datasetSessions.delete(providerId);
      },
    },
    policy,
    onFocusPolicyChange: () => {
      core.rerender();
      buildNav();
    },
    onChange: () => {
      lastRows = [];
      lastShownRows = [];
      refreshConnectionStatus();
      render();
    },
    onThemeChange: () => syncTheme(),
    getRows: () => lastRows,
    getAutoBots: () => adapterBotLogins(activeItems(), active.kinds),
  });
  const connectionStatus = mountConnectionStatus(statusHost, {
    openSettings(provider, category) {
      settings.open(provider, category);
    },
  });
  const openSettings = () =>
    settings.open(primaryProvider(active).id, "connections");

  const readyInsightKinds = (): Kind[] => catalog.kinds()
    .filter((kind) => kind.status === "ready")
    .map((kind) => kind.kind);

  const projectInsights = (): InsightSnapshot => buildInsightSnapshot({
    items: activeItems(),
    readyKinds: readyInsightKinds(),
    refreshedKinds: [...new Set(
      activeDatasetSnapshot()?.slices
        .filter((slice) => slice.freshness === "fresh")
        .map((slice) => slice.kind) ?? [],
    )],
    staleKinds: [...new Set(
      activeDatasetSnapshot()?.slices
        .filter((slice) => slice.freshness !== "fresh")
        .map((slice) => slice.kind) ?? [],
    )],
    catalog,
    score: scoreContext(),
    botLogins: policy.getBotLogins(),
    now: Date.now(),
  });

  const handleInsightRoute = (route: Parameters<typeof resolveInsightRoute>[0]["route"]) => {
    const resolved = resolveInsightRoute({
      route,
      catalog,
      repositories: [...new Set(activeItems().map((item) => item.location))],
    });
    if (resolved.destination === "settings") {
      settings.open(
        primaryProvider(active).id,
        resolved.category === "filters" ? "exclusions" : resolved.category,
      );
      return;
    }
    applySessionUpdate(session.openInsightRoute(resolved));
  };

  async function presentInsights(refresh: boolean): Promise<void> {
    root.setAttribute("role", "tabpanel");
    root.setAttribute("aria-labelledby", "view-tab-insights");
    const datasetSession = activeDatasetSession();
    const datasetSnapshot = activeDatasetSnapshot();

    if (!datasetSession || !datasetSnapshot) {
      renderInsights(root, null, {
        state: "empty",
        emptyReason: "no-provider",
        onRoute: handleInsightRoute,
      });
      return;
    }

    const failures = activeFailures();
    insightSnapshot = projectInsights();
    if (insightSnapshot) {
      renderInsights(root, insightSnapshot, {
        state: failures.length ? "partial" : "ready",
        failures,
        onRoute: handleInsightRoute,
      });
    }

    if (!refresh || insightRefreshing) return;
    insightRefreshing = true;
    try {
      await datasetSession.refresh();
      insightSnapshot = projectInsights();
      if (currentView() !== "insights") {
        core.rerender();
        return;
      }
      const hasItems = activeItems().length > 0;
      const currentFailures = activeFailures();
      renderInsights(root, insightSnapshot, {
        state: hasItems
          ? (currentFailures.length ? "partial" : "ready")
          : "empty",
        emptyReason: hasItems ? undefined : (currentFailures.length ? "unavailable" : "no-items"),
        failures: currentFailures,
        onRoute: handleInsightRoute,
      });
    } finally {
      insightRefreshing = false;
    }
  }

  gear.addEventListener("click", openSettings);
  refresh.addEventListener("click", () => {
    lastRows = [];
    lastShownRows = [];
    void core.refreshNow();
  });

  // Theme: the top-right control cycles the explicit choice (auto → light → dark)
  // and shows the choice's own glyph, so picking "auto" in Settings is never lost.
  function syncTheme() {
    const choice = getThemeChoice();
    themeBtn.innerHTML = choice === "auto" ? AUTO : choice === "dark" ? MOON : SUN;
    themeBtn.title = `Theme: ${choice} — click to cycle`;
  }
  themeBtn.addEventListener("click", () => { cycleTheme(); syncTheme(); });

  const activeProviderDeclaration = (): ProviderDeclaration => {
    const live = readyProvidersFor(active);
    return live.find((candidate) => candidate.id === currentProvider())
      ?? primaryProvider(active);
  };

  function needsRepositoryScope(): boolean {
    const snapshot = activeDatasetSnapshot();
    const repositoryField = activeProviderDeclaration().connection.scopeFields
      .find((field) => field.key === "repos");
    const repositories = repositoryField
      ? snapshot?.scope[repositoryField.key]
      : undefined;
    return connectedProviders.has(currentProvider())
      && repositoryField !== undefined
      && (!Array.isArray(repositories) || repositories.length === 0);
  }

  function refreshConnectionStatus(): void {
    const lead = activeProviderDeclaration();
    const snapshot = datasetSnapshots.get(lead.id);
    connectionStatus.render({
      provider: lead.id,
      connected: connectedProviders.has(lead.id),
      scopeSummary: snapshot
        ? scopeSummary(lead, snapshot.scope)
        : "scope not set",
      lastFetchedAt,
      cadence: snapshot?.cadence ?? "off",
      datasetState: connectionDatasetState(snapshot),
    });
  }
  // ── Navigation: grouped artifact rail (Findings / Work) → list/insights + filter ──
  const rail = document.getElementById("domainRail")!;
  const nav = document.getElementById("viewswitch")!;
  const root = document.getElementById("root")!;
  const handoffController = new HandoffController({
    session: () => session.snapshot(),
    scoreExplain,
    catalog,
  });

  function buildRail() {
    rail.innerHTML = "";
    for (const g of GROUP_ORDER) {
      const items = artifacts.filter(a => a.group === g);
      if (!items.length) continue;
      const section = document.createElement("div"); section.className = "rail-group";
      const heading = document.createElement("span"); heading.className = "rail-group-label"; heading.textContent = GROUP_LABEL[g];
      section.appendChild(heading);
      for (const a of items) {
        const live = readyProvidersFor(a).length > 0;
        const b = document.createElement("button");
        b.innerHTML = live ? esc(a.label) : `${esc(a.label)}<span class="rail-soon">soon</span>`;
        b.className = [a.id === active.id ? "active" : "", live ? "" : "upcoming"].filter(Boolean).join(" ");
        b.addEventListener("click", () => {
          applySessionUpdate(session.selectKind(a.id));
        });
        section.appendChild(b);
      }
      rail.appendChild(section);
    }
  }

  function buildNav() {
    lastNavRowSig = navRowSig();   // track the row-derived inputs this build reflects
    nav.innerHTML = "";
    if (!readyProvidersFor(active).length) return;   // upcoming artifact: no toolbar
    const base = assembleToolbarProps({
      artifact: active, rows: lastRows, filters: currentFilters(),
      hasInsights, activeView: currentView(),
      providers: providersForArtifact(active).map(s => ({ id: s.id, provider: s.id, status: s.status })),
      activeProvider: currentProvider(),
      activeRepo: currentRepository(),
      extraTabs: applicableCatalogTabs(catalog, active, lastRows)
        .map(t => ({ id: t.id, label: t.label })),
      focusPolicy: currentFocusPolicy(),
    });
    renderToolbar(nav, {
      ...base,
      catalog: catalog,
      onFilterChange,
      onLabelRulesChange: (labels) => {
        policy.setFocusPolicy({
          ...currentFocusPolicy(),
          labels,
        });
        core.rerender();
        buildNav();
      },
      onViewChange: (id) => {
        applySessionUpdate(session.selectView(id));
      },
      onProviderSelect: (id) => {
        applySessionUpdate(session.selectProvider(id));
      },
      onRepoSelect: (id) => {
        applySessionUpdate(session.selectRepository(id, lastRows));
      },
      delegationSelection: delegationSelectionControls(),
    });
  }

  // silent: an auto-refresh tick re-fetches in place (no skeleton flash).
  const render = (silent = false) => {
    root.setAttribute("role", "tabpanel");
    root.setAttribute("aria-labelledby", `view-tab-${currentView()}`);
    if (currentView() === "insights") {
      void presentInsights(true);
      return;
    }

    const live = readyProvidersFor(active);
    if (!live.length) {   // upcoming artifact placeholder
      const provs = providersForArtifact(active).map(s => `<li>${providerIcon(s.id, 14)} ${esc(s.id)}</li>`).join("");
      root.innerHTML = `<div class="upcoming"><h2>${esc(active.label)} <span class="badge">upcoming</span></h2>
        <p class="muted">On the roadmap. Will triage from:</p><ul class="prov-roadmap">${provs}</ul></div>`;
      lastFetchedAt = null;
      refreshConnectionStatus();
      return;
    }
    if (!silent && currentView() !== "list" && currentView() !== "insights" && lastRows.length) {
      const tab = catalog.tabs().find((candidate) => candidate.id === currentView());
      if (tab) { tab.render(root, lastRows); return; }
    }

    const needsRepositories = needsRepositoryScope();
    if (!activeDatasetSession() || needsRepositories) {
      const category = needsRepositories ? "repositories" : "connections";
      const label = needsRepositories
        ? "Choose repositories"
        : "Open Connections";
      root.innerHTML = `<div class="empty-state" data-provider-empty>
        <p class="muted">${needsRepositories
          ? "Choose at least one repository to begin triage."
          : "Connect a provider to begin triage."}</p>
        <button type="button" class="btn-primary" data-choose-repositories>${label}</button>
      </div>`;
      root.querySelector<HTMLElement>("[data-choose-repositories]")
        ?.addEventListener("click", () => {
          settings.open(currentProvider(), category);
        });
      lastFetchedAt = null;
      refreshConnectionStatus();
      return;
    }
    if (!silent && activeDatasetSnapshot()?.phase === "hydrating") {
      renderTableSkeleton(root);
    }
    core.rerender();
  };

  syncTheme();
  buildRail();
  buildNav();
  refreshConnectionStatus();
  setInterval(() => connectionStatus.updateTime(), 30_000);
  coreReady = true;
  const ready = (async () => {
    for (const provider of catalog.providers().filter((candidate) =>
      candidate.status === "ready")) {
      const connected = await env.datasets.resume(provider.id);
      if (!connected) continue;
      installDatasetSession(
        provider.id,
        connected,
        configuredScope(provider.id),
        "off",
      );
    }
    render();
  })();
  render();
  return Object.assign(core, { ready });
}
