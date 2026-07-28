import type { TriageConfigT } from "../../config/schema";
import { isCompiledConfig } from "./mode";
import type {
  ProviderDeclaration,
  RuntimeCatalog,
  Scorer,
} from "../catalog/types";
import { GROUP_LABEL, GROUP_ORDER, type Artifact } from "../dataset/artifact";
import { explainScoreModel, validateModel, type ScoreExplanation } from "../scoring/score-model";
import { renderTableSkeleton } from "../layout/table/triage-table";
import { esc } from "../layout/util";
import type { ScoredItem } from "../layout/table/kind-renderer";
import { renderInsights } from "../layout/insights";
import type { ListState } from "../layout/toolbar/filter-state";
import { renderToolbar, type ToolbarProps } from "../layout/toolbar/toolbar";
import { CredStore } from "./cred-store";
import { ScopeStore } from "./scope-store";
import { PolicyStore } from "./policy-store";
import { healthOf, scopeSummary } from "./health";
import { mountSettings } from "./settings";
import { providerIcon } from "./provider-icons";
import { getThemeChoice, cycleTheme } from "./theme";
import { getRefreshInterval, relativeSince } from "./refresh";
import { scopeKey } from "../core/scope-key";
import { adapterBotLogins } from "../core/author-policy";
import { refreshProviders } from "../core/orchestrator";
import type { DatasetStore } from "../core/store";
import type { TimerPort, ViewPort } from "../core/ports";
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
import { buildInsightRefreshJobs } from "../insights/refresh";
import { resolveInsightRoute } from "../insights/routes";
import type { InsightSnapshot } from "../insights/types";
import type { Kind } from "../dataset/item";
import type { TriageFailure } from "../catalog/types";

export interface ShellEnv {
  catalog: RuntimeCatalog;
  session?: TriageSession;
  sessionUrl?: SessionUrlAdapter;
  store: DatasetStore;
  timer: TimerPort;
  createCore: (deps: CoreDeps) => Core;
  createDomView: (host: HTMLElement, deps: DomViewDeps) => ViewPort;
  scoreOverride?: Scorer;
}

const applicableCatalogTabs = (
  catalog: RuntimeCatalog,
  artifact: Artifact,
  rows: ScoredItem[],
) =>
  catalog.tabs()
    .filter((tab) => tab.appliesTo(artifact, rows))
    .sort((a, b) => a.order - b.order);

const connectionKey = (provider: ProviderDeclaration): string => provider.id;
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
}

// Pure assembly of the toolbar's view-mode / provider-scope / filter props from the
// shell's state, extracted so it's testable without mounting the whole shell.
function assembleToolbarProps(i: ToolbarPropsInput): Omit<ToolbarProps, "onFilterChange" | "onViewChange" | "onProviderSelect" | "onRepoSelect"> {
  const viewModes = [{ id: "list", label: "List" }];
  if (i.hasInsights) viewModes.push({ id: "insights", label: "Insights" });
  for (const t of i.extraTabs) viewModes.push({ id: t.id, label: t.label });
  const providers = i.providers.map(s => ({
    id: s.id, label: s.provider, on: s.id === i.activeProvider, live: s.status === "ready",
  }));
  // Repo display-scope options: distinct row locations, count-descending.
  const counts = new Map<string, number>();
  for (const r of i.rows) counts.set(r.location, (counts.get(r.location) ?? 0) + 1);
  const repos = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([location]) => ({ id: location, label: location }));
  // Coerce the displayed active tab to "All" when the sticky repo isn't among the
  // current options — matches derive()'s auto-fallback. State is NOT reset upstream,
  // so stickiness survives a round-trip to an artifact that DOES have the repo.
  const activeRepo = repos.some(r => r.id === i.activeRepo) ? i.activeRepo : "";
  // The toolbar's filter options + count derive from `rows`; scope them to the active
  // repo so labels (and the count) are per-repo. The repo TABS, computed above from the
  // full set, still list every repo so the user can switch.
  const rows = activeRepo ? i.rows.filter(r => r.location === activeRepo) : i.rows;
  return { artifact: i.artifact, rows, filters: i.filters, viewModes, activeView: i.activeView, providers, repos, activeRepo };
}

export function mountShell(config: TriageConfigT, env: ShellEnv): Core {
  const catalog = env.catalog;
  const session = env.session ?? createTriageSession({ catalog });
  const sessionUrl = env.sessionUrl ?? createBrowserSessionUrl(window);
  const creds = new CredStore();
  const scopes = new ScopeStore();
  const policy = new PolicyStore();
  if (isCompiledConfig(config)) {
    scopes.set(config.source, config.scope!);
  }
  const hasInsights = true;

  const providersForArtifact = (a: Artifact) =>
    catalog.providersFor(a.kinds[0]);
  const readyProvidersFor = (a: Artifact) => providersForArtifact(a).filter(s => s.status === "ready");
  const artifacts = catalog.artifacts().filter(a => providersForArtifact(a).length > 0);
  const primaryProvider = (a: Artifact): ProviderDeclaration =>
    readyProvidersFor(a)[0] ?? providersForArtifact(a)[0];

  const initialSession = session.restore(sessionUrl.read()).state;
  let active: Artifact = catalog.artifact(initialSession.kind)
    ?? artifacts.find((artifact) => readyProvidersFor(artifact).length)
    ?? artifacts[0];
  const currentView = () => session.snapshot().view;
  const currentProvider = () => session.snapshot().provider;
  const currentRepository = () => session.snapshot().effectiveRepository;
  const currentFilters = () => session.snapshot().filters;
  let lastRows: ScoredItem[] = [];
  let lastFetchedAt: number | null = null;
  let insightSnapshot: InsightSnapshot | null = null;
  let insightFailures: TriageFailure[] = [];
  let insightRefreshedKinds: Kind[] = [];
  let insightRefreshing = false;
  let cancelRefresh: (() => void) | undefined;

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

  // The credentialed, scoped sources for the active artifact's active provider.
  const usableProviders = () => readyProvidersFor(active).filter(provider =>
    provider.id === currentProvider()
    && creds.get(connectionKey(provider))
    && Object.keys(scopes.get(connectionKey(provider))).length);

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
      lastFetchedAt = Date.now(); updateSync();
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
      if (!usableProviders().length) {
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
      // createDomView is called per-render intentionally: artifact: active and token
      // both reflect the current artifact/credential at render time and go stale if
      // captured at construction (active is reassigned when the user switches artifacts).
      const token = creds.get(connectionKey(usableProviders()[0]))!;  // usableProviders filter guarantees a credential
      env.createDomView(root, {
        artifact: active,
        token,
        providerId: currentProvider(),
        scoreExplain,
        catalog: catalog,
        handoffController,
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
    store: env.store,
    view: dispatchView,
    jobsFor: () => usableProviders().map(s => ({
      provider: s,
      scopeKey: scopeKey(scopes.get(connectionKey(s))),
      scope: scopes.get(connectionKey(s)),
      credential: creds.get(connectionKey(s))!,
      kinds: active.kinds.filter(kind => s.kinds.includes(kind)),
    })),
    activeKinds: () => active.kinds,
    botLogins: () => policy.getBotLogins(),
    scoreContext,
    filters: currentFilters,
    repoView: currentRepository,
  });

  function applySessionUpdate(update: SessionUpdate): void {
    active = catalog.artifact(update.state.kind) ?? active;
    sessionUrl.write(update.serialized);

    if (update.work === "refresh") {
      lastRows = [];
      lastFetchedAt = null;
      buildRail();
      buildNav();
      refreshBar();
      void core.refreshNow();
    } else if (update.work === "rederive") {
      core.rerender();
      buildNav();
    } else if (update.work === "present") {
      buildRail();
      buildNav();
      refreshBar();
      if (update.state.view === "insights" || catalog.kind(update.state.kind)?.status === "upcoming") {
        render();
      } else {
        core.rerender();
      }
    }
  }

  // ── Command bar: brand + merged status chip + sync stamp + refresh + theme ──
  const bar = document.getElementById("appbar")!;
  const titleHtml = esc(config.branding.title).replace(/·/g, `<span class="dot">·</span>`);
  bar.innerHTML = `<h1 class="brand">${BRAND_MARK}<span class="wordmark">${titleHtml}</span></h1><div class="spacer"></div>`;
  const status = document.createElement("button"); status.className = "status-chip";
  const sync = document.createElement("span"); sync.className = "last-sync";
  const refresh = document.createElement("button"); refresh.className = "icon-btn"; refresh.setAttribute("aria-label", "Refresh now"); refresh.title = "Refresh now"; refresh.innerHTML = REFRESH;
  const themeBtn = document.createElement("button"); themeBtn.className = "icon-btn"; themeBtn.setAttribute("aria-label", "Toggle theme");
  const gear = document.createElement("button"); gear.className = "icon-btn"; gear.setAttribute("aria-label", "Settings"); gear.title = "Settings"; gear.innerHTML = GEAR;
  bar.append(status, sync, refresh, themeBtn, gear);

  const settingsHost = document.getElementById("settings-host")!;
  const settings = mountSettings(settingsHost, {
    catalog,
    providers: [...catalog.providers()], creds, scopes, policy,
    onChange: () => { lastRows = []; refreshBar(); render(); },
    onThemeChange: () => syncTheme(),
    onRefreshChange: () => applyRefreshTimer(),
    getRows: () => lastRows,
    getAutoBots: () => adapterBotLogins(env.store.snapshot(), active.kinds),
  });
  const openSettings = () => settings.open(primaryProvider(active).id);

  const insightJobs = () => buildInsightRefreshJobs({
    catalog,
    credentialFor: (providerId) => {
      const provider = catalog.providers().find((candidate) => candidate.id === providerId);
      return provider ? creds.get(connectionKey(provider)) ?? undefined : undefined;
    },
    scopeFor: (providerId) => {
      const provider = catalog.providers().find((candidate) => candidate.id === providerId);
      return provider ? scopes.get(connectionKey(provider)) : {};
    },
    scopeKeyFor: (_providerId, scope) => scopeKey(scope),
  });

  const readyInsightKinds = (): Kind[] => catalog.kinds()
    .filter((kind) => kind.status === "ready")
    .map((kind) => kind.kind);

  const projectInsights = (): InsightSnapshot => buildInsightSnapshot({
    items: env.store.snapshot(),
    readyKinds: readyInsightKinds(),
    refreshedKinds: insightRefreshedKinds,
    staleKinds: readyInsightKinds().filter((kind) => !insightRefreshedKinds.includes(kind)),
    catalog,
    score: scoreContext(),
    botLogins: policy.getBotLogins(),
    now: Date.now(),
  });

  const handleInsightRoute = (route: Parameters<typeof resolveInsightRoute>[0]["route"]) => {
    const resolved = resolveInsightRoute({
      route,
      catalog,
      repositories: [...new Set(env.store.snapshot().map((item) => item.location))],
    });
    if (resolved.destination === "settings") {
      settings.open(primaryProvider(active).id, resolved.category);
      return;
    }
    applySessionUpdate(session.openInsightRoute(resolved));
  };

  async function presentInsights(refresh: boolean): Promise<void> {
    root.setAttribute("role", "tabpanel");
    root.setAttribute("aria-labelledby", "view-tab-insights");
    const jobs = insightJobs();
    const readyProviders = catalog.providers()
      .filter((provider) => provider.status === "ready" && provider.adapter);

    if (jobs.length === 0) {
      const hasCredential = readyProviders.some((provider) =>
        Boolean(creds.get(connectionKey(provider))),
      );
      renderInsights(root, null, {
        state: "empty",
        emptyReason: readyProviders.length === 0 || !hasCredential
          ? "no-provider"
          : "no-scope",
        onRoute: handleInsightRoute,
      });
      return;
    }

    if (insightSnapshot) {
      renderInsights(root, insightSnapshot, {
        state: insightFailures.length ? "partial" : "ready",
        failures: insightFailures,
        onRoute: handleInsightRoute,
      });
    } else {
      renderInsights(root, null, {
        state: "loading",
        onRoute: handleInsightRoute,
      });
    }

    if (!refresh || insightRefreshing) return;
    insightRefreshing = true;
    try {
      const result = await refreshProviders(jobs, env.store);
      insightFailures = result.failures;
      const failedProviders = new Set(
        result.failures.filter((failure) => !failure.kind).map((failure) => failure.provider),
      );
      const failedKinds = new Set(
        result.failures.flatMap((failure) => failure.kind ? [failure.kind] : []),
      );
      insightRefreshedKinds = [...new Set(jobs.flatMap((job) =>
        failedProviders.has(job.provider.id)
          ? []
          : job.kinds.filter((kind) => !failedKinds.has(kind)),
      ))];
      insightSnapshot = projectInsights();
      if (currentView() !== "insights") {
        core.rerender();
        return;
      }
      const hasItems = env.store.snapshot().length > 0;
      renderInsights(root, insightSnapshot, {
        state: hasItems
          ? (insightFailures.length ? "partial" : "ready")
          : "empty",
        emptyReason: hasItems ? undefined : (insightFailures.length ? "unavailable" : "no-items"),
        failures: insightFailures,
        onRoute: handleInsightRoute,
      });
    } finally {
      insightRefreshing = false;
    }
  }

  status.addEventListener("click", openSettings);
  gear.addEventListener("click", openSettings);
  refresh.addEventListener("click", () => { lastRows = []; render(); });

  // Theme: the top-right control cycles the explicit choice (auto → light → dark)
  // and shows the choice's own glyph, so picking "auto" in Settings is never lost.
  function syncTheme() {
    const choice = getThemeChoice();
    themeBtn.innerHTML = choice === "auto" ? AUTO : choice === "dark" ? MOON : SUN;
    themeBtn.title = `Theme: ${choice} — click to cycle`;
  }
  themeBtn.addEventListener("click", () => { cycleTheme(); syncTheme(); });

  // Status chip shows the single active provider scope.
  function refreshBar() {
    const live = readyProvidersFor(active);
    const lead = live.find(s => s.id === currentProvider()) ?? primaryProvider(active);
    let cls = "warn", tail: string;
    if (!live.length) { tail = "upcoming"; }
    else {
      const missing = healthOf(lead, creds) !== "connected";
      cls = missing ? "warn" : "ok";
      tail = missing ? "no token" : scopeSummary(lead, scopes.get(connectionKey(lead)));
    }
    status.className = "status-chip " + cls;
    status.innerHTML = `${providerIcon(lead.id, 15)}<span class="sid">${esc(lead.id)}</span><span class="sep">·</span><span class="muted">${esc(tail)}</span>`;
  }

  function updateSync() {
    sync.textContent = lastFetchedAt == null ? "" : `updated ${relativeSince(lastFetchedAt)}`;
  }
  function applyRefreshTimer() {
    if (cancelRefresh) cancelRefresh();
    const secs = getRefreshInterval();
    if (secs > 0) cancelRefresh = env.timer.every(secs * 1000, () => { if (readyProvidersFor(active).length) render(true); });
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
    });
    renderToolbar(nav, {
      ...base,
      catalog: catalog,
      onFilterChange,
      onViewChange: (id) => {
        applySessionUpdate(session.selectView(id));
      },
      onProviderSelect: (id) => {
        applySessionUpdate(session.selectProvider(id));
      },
      onRepoSelect: (id) => {
        applySessionUpdate(session.selectRepository(id, lastRows));
      },
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
      lastFetchedAt = null; updateSync();
      return;
    }
    if (!silent && currentView() !== "list" && currentView() !== "insights" && lastRows.length) {
      const tab = catalog.tabs().find((candidate) => candidate.id === currentView());
      if (tab) { tab.render(root, lastRows); return; }
    }

    if (!usableProviders().length) {
      const needScope = live.some(s => s.id === currentProvider() && creds.get(connectionKey(s)) && !Object.keys(scopes.get(connectionKey(s))).length);
      root.innerHTML = `<p class="muted">Open Settings to ${needScope ? "choose your scope" : "connect a token"}.</p>`;
      lastFetchedAt = null; updateSync();
      return;
    }
    if (!silent) renderTableSkeleton(root);
    core.refreshNow();   // refresh → derive → dispatchView.render(vm)
  };

  syncTheme();
  buildRail();
  buildNav();
  refreshBar();
  updateSync();
  applyRefreshTimer();
  setInterval(updateSync, 30_000);   // keep the "updated Xm ago" stamp fresh
  render();
  return core;
}
