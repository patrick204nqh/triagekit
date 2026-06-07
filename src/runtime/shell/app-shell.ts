import type { TriageConfigT } from "../../config/schema";
import { isCompiledConfig } from "./mode";
import { getSource, listSources, providerOf, type Source } from "../ingest/source";
import { listArtifacts, GROUP_LABEL, GROUP_ORDER, type Artifact } from "../dataset/artifact";
import type { Scorer } from "../scoring/registry";
import { fieldsFor } from "../scoring/field-catalog";
import { explainScoreModel, validateModel, type ScoreExplanation } from "../scoring/score-model";
import { renderTableSkeleton, esc, type ScoredItem } from "../layout/triage-table";
import { renderInsights } from "../layout/insights";
import { applicableTabs, getTab } from "../layout/tab-registry";
import { getSortKey, getFilterAxis } from "../layout/axis-registry";
import { emptyListState, type ListState } from "../layout/filter-state";
import { renderToolbar, type ToolbarProps } from "../layout/toolbar";
import { CredStore } from "./cred-store";
import { ScopeStore } from "./scope-store";
import { PolicyStore } from "./policy-store";
import { healthOf, scopeSummary } from "./health";
import { mountSettings } from "./settings";
import { providerIcon } from "./provider-icons";
import { getThemeChoice, cycleTheme } from "./theme";
import { writeUrlState, readUrlState } from "./url-state";
import { getRefreshInterval, relativeSince } from "./refresh";
import { scopeKey } from "../core/scope-key";
import { getProvider } from "../core/provider-registry";
import type { DatasetStore } from "../core/store";
import type { TimerPort, ViewPort } from "../core/ports";
import type { CoreDeps, Core } from "../core/core";
import type { DomViewDeps } from "../adapters/dom-view";

export interface ShellEnv {
  store: DatasetStore;
  timer: TimerPort;
  createCore: (deps: CoreDeps) => Core;
  createDomView: (host: HTMLElement, deps: DomViewDeps) => ViewPort;
  scoreOverride?: Scorer;
}

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
  artifact: Artifact; rows: ScoredItem[]; facets: ListState;
  hasInsights: boolean; activeView: string;
  sources: { id: string; provider: string; status: string }[];
  activeProvider: string;
  activeRepo: string;
  extraTabs: { id: string; label: string }[];
}

// Pure assembly of the toolbar's view-mode / provider-scope / facet props from the
// shell's state, extracted so it's testable without mounting the whole shell.
export function toolbarPropsFromShell(i: ToolbarPropsInput): Omit<ToolbarProps, "onFacetChange" | "onViewChange" | "onProviderSelect" | "onRepoSelect"> {
  const viewModes = [{ id: "list", label: "List" }];
  if (i.hasInsights) viewModes.push({ id: "insights", label: "Insights" });
  for (const t of i.extraTabs) viewModes.push({ id: t.id, label: t.label });
  const providers = i.sources.map(s => ({
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
  return { artifact: i.artifact, rows: i.rows, facets: i.facets, viewModes, activeView: i.activeView, providers, repos, activeRepo };
}

export function mountShell(config: TriageConfigT, env: ShellEnv): Core {
  const creds = new CredStore();
  const scopes = new ScopeStore();
  const policy = new PolicyStore();
  const liveSource = getSource(config.source);
  if (isCompiledConfig(config)) scopes.set(providerOf(liveSource), config.scope!);
  const hasInsights = config.views.includes("insights");

  const sourcesFor = (a: Artifact) => listSources().filter(s => s.kinds.some(k => a.kinds.includes(k)));
  const liveSourcesFor = (a: Artifact) => sourcesFor(a).filter(s => s.status === "ready");
  const artifacts = listArtifacts().filter(a => sourcesFor(a).length > 0);
  const primarySource = (a: Artifact): Source => liveSourcesFor(a)[0] ?? sourcesFor(a)[0];
  const navLabel = (a: Artifact): string => {
    const src = primarySource(a);
    const m = src ? getProvider(providerOf(src)) : undefined;
    return m?.labels?.[a.kinds[0]] ?? a.label;
  };

  let active: Artifact = artifacts.find(a => liveSourcesFor(a).length) ?? artifacts[0];
  let view: string = "list";
  let activeProvider: string = (liveSourcesFor(active)[0] ?? sourcesFor(active)[0])?.id ?? "";
  let activeRepo = "";   // "" = All; sticky across artifact switches, reset on provider change
  let lastRows: ScoredItem[] = [];
  let facetState: ListState = emptyListState();
  let lastFetchedAt: number | null = null;
  let cancelRefresh: (() => void) | undefined;

  // Signature of the toolbar's row-derived inputs (distinct repo locations + applicable
  // extra-tab ids for the active artifact). dispatchView rebuilds the toolbar only when
  // this changes, so post-fetch data surfaces new repo tabs without rebuilding (and
  // closing open popovers) on every render. buildNav() refreshes it after each build.
  // Deliberately omits repo counts: a silent refresh that only reorders the (unchanged)
  // location set won't rebuild — tolerating cosmetic tab-order lag to keep popovers open.
  const navRowSig = () =>
    [...new Set(lastRows.map(r => r.location))].sort().join(",") +
    "|" + applicableTabs(active, lastRows).map(t => t.id).sort().join(",");
  let lastNavRowSig = "";

  // --- Apply URL state on load (artifact → provider → repo → view → sort/axes) ---
  // Runs before the first buildRail/buildNav/render and before any syncUrl(), so a
  // bookmarked / shared / reloaded URL is honored, not clobbered. Each field is
  // validated independently; invalid/absent values silently keep today's defaults.
  {
    const u = readUrlState();

    // artifact: only if it's a known artifact id (artifact id === kind)
    if (u.artifact) {
      const a = artifacts.find(x => x.id === u.artifact);
      if (a) active = a;
    }

    // provider: only if it's a source id within the (resolved) artifact's sources
    if (u.provider) {
      const ok = sourcesFor(active).some(s => s.id === u.provider);
      if (ok) activeProvider = u.provider;
    }

    // repo: applied optimistically (cannot validate pre-fetch; self-corrects via the
    // repo control + the "All" fallback when the repo isn't among the loaded rows)
    if (u.repo) activeRepo = u.repo;

    // view: list / insights (when available) / a registered extra tab applicable to
    // the artifact. applicableTabs needs rows to report a tab applicable, so pre-fetch
    // an extra-tab id may fall back to "list" — acceptable degradation; it self-heals
    // once data loads and the user re-selects the tab.
    if (u.view) {
      const isExtra = applicableTabs(active, []).some(t => t.id === u.view);
      if (u.view === "list" || (u.view === "insights" && hasInsights) || isExtra) view = u.view;
    }

    // sort: only if the sort key exists
    if (u.sort && getSortKey(u.sort)) facetState = { ...facetState, sort: u.sort };

    // axes: only axis ids that exist (values not deep-validated — unknown values match nothing)
    if (u.axes) {
      const axes: Record<string, string[]> = { ...facetState.axes };
      for (const [id, vals] of Object.entries(u.axes)) {
        if (getFilterAxis(id) && vals.length) axes[id] = vals;
      }
      facetState = { ...facetState, axes };
    }
  }

  // The credentialed, scoped sources for the active artifact's active provider.
  const usableSources = () => liveSourcesFor(active).filter(s =>
    s.id === activeProvider && creds.get(providerOf(s)) && Object.keys(scopes.get(providerOf(s))).length);

  // Per-item score breakdown for the list drawer (lifted from renderListWithFacets).
  const scoreExplain = (i: ScoredItem): ScoreExplanation | null => {
    const m = policy.getScoreModel(i.kind);
    if (!m || validateModel(m, fieldsFor(i.kind)).length !== 0) return null;
    try { return explainScoreModel(m, i); } catch { return null; }
  };

  // Assemble the current page state and mirror it to the URL query string.
  // Called from every state-mutation handler (replaceState — no history spam).
  const syncUrl = () => {
    const { sort, axes } = facetState;
    writeUrlState({
      provider: activeProvider || undefined,
      repo: activeRepo || undefined,
      artifact: active?.id,
      view,
      sort,
      axes,
    });
  };

  // Facet change: update state, re-derive from the store (no refetch).
  const onFacetChange = (next: ListState) => { facetState = next; syncUrl(); core.rerender(); };

  // Dispatcher view: owns view-mode selection (mirrors the original post-fetch
  // branching). insights/tab render directly; list mode delegates to the DOM view.
  const dispatchView: ViewPort = {
    render(vm) {
      lastRows = vm.scored;
      lastFetchedAt = Date.now(); updateSync();
      // The toolbar's repo tabs and applicable extra tabs are derived from the rows,
      // which are empty at the initial buildNav() and only arrive here post-fetch.
      // Rebuild the toolbar when that row-derived set actually changes — but not on
      // every paint, so a background refresh doesn't tear down an open filter popover.
      if (navRowSig() !== lastNavRowSig) buildNav();
      if (view === "insights") { renderInsights(root, vm.scored, active.kinds); return; }
      if (view !== "list") { const t = getTab(view); if (t) { t.render(root, vm.scored); return; } }
      // createDomView is called per-render intentionally: artifact: active and token
      // both reflect the current artifact/credential at render time and go stale if
      // captured at construction (active is reassigned when the user switches artifacts).
      const token = creds.get(providerOf(usableSources()[0]))!;  // usableSources filter guarantees a credential
      env.createDomView(root, { artifact: active, token, scoreExplain }).render(vm);
    },
  };

  const core = env.createCore({
    store: env.store,
    view: dispatchView,
    jobsFor: () => usableSources().map(s => ({
      provider: providerOf(s),
      scopeKey: scopeKey(scopes.get(providerOf(s))),
      scope: scopes.get(providerOf(s)),
      token: creds.get(providerOf(s))!,
      port: s,
    })),
    activeKinds: () => active.kinds,
    botLogins: () => policy.getBotLogins(),
    scoreContext: () => ({
      getModel: (k) => policy.getScoreModel(k),
      getFields: (k) => fieldsFor(k),
      getThresholds: () => policy.getTiers(),
      override: env.scoreOverride,
    }),
    facets: () => facetState,
    repo: () => activeRepo,
  });

  // ── Command bar: brand + merged status chip + sync stamp + refresh + theme ──
  const bar = document.getElementById("appbar")!;
  const titleHtml = esc(config.branding.title).replace(/·/g, `<span class="dot">·</span>`);
  bar.innerHTML = `<span class="brand">${BRAND_MARK}<span class="wordmark">${titleHtml}</span></span><div class="spacer"></div>`;
  const status = document.createElement("button"); status.className = "status-chip";
  const sync = document.createElement("span"); sync.className = "last-sync";
  const refresh = document.createElement("button"); refresh.className = "icon-btn"; refresh.setAttribute("aria-label", "Refresh now"); refresh.title = "Refresh now"; refresh.innerHTML = REFRESH;
  const themeBtn = document.createElement("button"); themeBtn.className = "icon-btn"; themeBtn.setAttribute("aria-label", "Toggle theme");
  const gear = document.createElement("button"); gear.className = "icon-btn"; gear.setAttribute("aria-label", "Settings"); gear.title = "Settings"; gear.innerHTML = GEAR;
  bar.append(status, sync, refresh, themeBtn, gear);

  const settingsHost = document.getElementById("settings-host")!;
  const settings = mountSettings(settingsHost, {
    sources: listSources(), creds, scopes, policy,
    onChange: () => { lastRows = []; refreshBar(); render(); },
    onThemeChange: () => syncTheme(),
    onRefreshChange: () => applyRefreshTimer(),
    getRows: () => lastRows,
  });
  const openSettings = () => settings.open(providerOf(primarySource(active)));
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
    const live = liveSourcesFor(active);
    const lead = live.find(s => s.id === activeProvider) ?? primarySource(active);
    let cls = "warn", tail: string;
    if (!live.length) { tail = "upcoming"; }
    else {
      const missing = healthOf(lead, creds) !== "connected";
      cls = missing ? "warn" : "ok";
      tail = missing ? "no token" : scopeSummary(lead, scopes.get(providerOf(lead)));
    }
    status.className = "status-chip " + cls;
    status.innerHTML = `${providerIcon(providerOf(lead), 15)}<span class="sid">${esc(providerOf(lead))}</span><span class="sep">·</span><span class="muted">${esc(tail)}</span>`;
  }

  function updateSync() {
    sync.textContent = lastFetchedAt == null ? "" : `updated ${relativeSince(lastFetchedAt)}`;
  }
  function applyRefreshTimer() {
    if (cancelRefresh) cancelRefresh();
    const secs = getRefreshInterval();
    if (secs > 0) cancelRefresh = env.timer.every(secs * 1000, () => { if (liveSourcesFor(active).length) render(true); });
  }

  // ── Navigation: grouped artifact rail (Findings / Work) → list/insights + facet ──
  const rail = document.getElementById("domainRail")!;
  const nav = document.getElementById("viewswitch")!;
  const root = document.getElementById("root")!;

  function buildRail() {
    rail.innerHTML = "";
    for (const g of GROUP_ORDER) {
      const items = artifacts.filter(a => a.group === g);
      if (!items.length) continue;
      const section = document.createElement("div"); section.className = "rail-group";
      const heading = document.createElement("span"); heading.className = "rail-group-label"; heading.textContent = GROUP_LABEL[g];
      section.appendChild(heading);
      for (const a of items) {
        const live = liveSourcesFor(a).length > 0;
        const b = document.createElement("button");
        b.innerHTML = live ? esc(navLabel(a)) : `${esc(navLabel(a))}<span class="rail-soon">soon</span>`;
        b.className = [a.id === active.id ? "active" : "", live ? "" : "upcoming"].filter(Boolean).join(" ");
        b.addEventListener("click", () => {
          active = a; view = "list"; activeProvider = (liveSourcesFor(a)[0] ?? sourcesFor(a)[0])?.id ?? "";
          lastRows = []; facetState = emptyListState(); lastFetchedAt = null;
          syncUrl();
          buildRail(); buildNav(); refreshBar(); render();
        });
        section.appendChild(b);
      }
      rail.appendChild(section);
    }
  }

  function buildNav() {
    lastNavRowSig = navRowSig();   // track the row-derived inputs this build reflects
    nav.innerHTML = "";
    if (!liveSourcesFor(active).length) return;   // upcoming artifact: no toolbar
    const base = toolbarPropsFromShell({
      artifact: active, rows: lastRows, facets: facetState,
      hasInsights, activeView: view,
      sources: sourcesFor(active).map(s => ({ id: s.id, provider: providerOf(s), status: s.status })),
      activeProvider,
      activeRepo,
      extraTabs: applicableTabs(active, lastRows).map(t => ({ id: t.id, label: t.label })),
    });
    renderToolbar(nav, {
      ...base,
      onFacetChange,
      onViewChange: (id) => { view = id; syncUrl(); buildNav(); render(); },
      onProviderSelect: (id) => {
        activeProvider = id;
        activeRepo = "";
        lastRows = []; facetState = emptyListState(); lastFetchedAt = null;
        syncUrl();
        buildNav(); refreshBar(); render();
      },
      onRepoSelect: (id) => {
        activeRepo = id;
        syncUrl();
        core.rerender();      // client-side re-derive, no refetch
        buildNav();           // re-render tabs so the active one updates
      },
    });
  }

  // silent: an auto-refresh tick re-fetches in place (no skeleton flash).
  const render = (silent = false) => {
    const live = liveSourcesFor(active);
    if (!live.length) {   // upcoming artifact placeholder
      const provs = sourcesFor(active).map(s => `<li>${providerIcon(providerOf(s), 14)} ${esc(providerOf(s))}</li>`).join("");
      root.innerHTML = `<div class="upcoming"><h2>${esc(navLabel(active))} <span class="badge">upcoming</span></h2>
        <p class="muted">On the roadmap. Will triage from:</p><ul class="prov-roadmap">${provs}</ul></div>`;
      lastFetchedAt = null; updateSync();
      return;
    }
    if (!silent && view === "insights" && lastRows.length) { renderInsights(root, lastRows, active.kinds); return; }
    if (!silent && view !== "list" && view !== "insights" && lastRows.length) {
      const t = getTab(view); if (t) { t.render(root, lastRows); return; }
    }

    if (!usableSources().length) {
      const needScope = live.some(s => s.id === activeProvider && creds.get(providerOf(s)) && !Object.keys(scopes.get(providerOf(s))).length);
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
