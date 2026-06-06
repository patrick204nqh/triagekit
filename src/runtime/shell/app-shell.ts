import type { TriageConfigT } from "../../config/schema";
import { isCompiledConfig } from "./mode";
import { getSource, listSources, providerOf, type Source, type TriageError } from "../ingest/source";
import { listArtifacts, GROUP_LABEL, GROUP_ORDER, type Artifact } from "../dataset/artifact";
import { resolveScorer, type Scorer } from "../scoring/registry";
import { tierOf } from "../scoring/tier";
import { renderTriageList, renderTableSkeleton, esc, type ScoredItem } from "../layout/triage-table";
import { renderInsights } from "../layout/insights";
import { renderFacetBar, applyFacets, emptyFacetState, type FacetState } from "../layout/facet-bar";
import { CredStore } from "./cred-store";
import { ScopeStore } from "./scope-store";
import { healthOf, scopeSummary } from "./health";
import { mountSettings } from "./settings";
import { providerIcon } from "./provider-icons";
import { getThemeChoice, cycleTheme } from "./theme";
import { getRefreshInterval, relativeSince } from "./refresh";
import "../views/security-alerts/view";   // register view + scorer + ready source + charts
import "../views/review/view";            // register review surface + scorer + github-review source
import "../ingest/upcoming";              // register roadmap sources

// Product mark: a funnel (many signals in → a triaged few out) whose drip is the
// teal accent, echoing the "·" in the wordmark.
const BRAND_MARK = `<svg class="brand-mark" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3.5 5.5H20.5L13 14.5V18H11V14.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="20.8" r="1.7" fill="var(--accent)"/></svg>`;
const SUN = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`;
const MOON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
const GEAR = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
// "Auto" theme = follow the OS; its icon is a monitor, distinct from sun/moon.
const AUTO = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`;
const REFRESH = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>`;

export function mountShell(config: TriageConfigT, scoreOverride?: Scorer) {
  const creds = new CredStore();
  const scopes = new ScopeStore();
  const liveSource = getSource(config.source);
  if (isCompiledConfig(config)) scopes.set(providerOf(liveSource), config.scope!);
  const hasInsights = config.views.includes("insights");

  const sourcesFor = (a: Artifact) => listSources().filter(s => s.kinds.some(k => a.kinds.includes(k)));
  const liveSourcesFor = (a: Artifact) => sourcesFor(a).filter(s => s.status === "ready");
  const artifacts = listArtifacts().filter(a => sourcesFor(a).length > 0);
  const primarySource = (a: Artifact): Source => liveSourcesFor(a)[0] ?? sourcesFor(a)[0];

  let active: Artifact = artifacts.find(a => liveSourcesFor(a).length) ?? artifacts[0];
  let view: "list" | "insights" = "list";
  let selected = new Set(liveSourcesFor(active).map(s => s.id));   // provider facet
  let lastRows: ScoredItem[] = [];
  let facetState: FacetState = emptyFacetState();
  let lastFetchedAt: number | null = null;
  let refreshTimer: ReturnType<typeof setInterval> | undefined;

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
    sources: listSources(), creds, scopes,
    onChange: () => { lastRows = []; refreshBar(); render(); },
    onThemeChange: () => syncTheme(),
    onRefreshChange: () => applyRefreshTimer(),
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

  // Status chip reflects the active artifact's selected providers (not just one):
  // a single provider shows its scope; several show a count, warning if any is
  // missing a credential.
  function refreshBar() {
    const live = liveSourcesFor(active);
    const sel = live.filter(s => selected.has(s.id));
    const srcs = sel.length ? sel : [primarySource(active)];
    const lead = srcs[0];
    let cls = "warn", tail: string;
    if (!live.length) { tail = "upcoming"; }
    else {
      const missing = srcs.some(s => healthOf(s, creds) !== "connected");
      cls = missing ? "warn" : "ok";
      if (srcs.length === 1) tail = missing ? "no token" : scopeSummary(lead, scopes.get(providerOf(lead)));
      else tail = missing ? `${srcs.length} providers · no token` : `${srcs.length} providers`;
    }
    status.className = "status-chip " + cls;
    const label = srcs.length > 1 ? `${esc(providerOf(lead))} +${srcs.length - 1}` : esc(providerOf(lead));
    status.innerHTML = `${providerIcon(providerOf(lead), 15)}<span class="sid">${label}</span><span class="sep">·</span><span class="muted">${esc(tail)}</span>`;
  }

  function updateSync() {
    sync.textContent = lastFetchedAt == null ? "" : `updated ${relativeSince(lastFetchedAt)}`;
  }
  function applyRefreshTimer() {
    if (refreshTimer) clearInterval(refreshTimer);
    const secs = getRefreshInterval();
    if (secs > 0) refreshTimer = setInterval(() => { if (liveSourcesFor(active).length) render(true); }, secs * 1000);
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
        b.innerHTML = live ? esc(a.label) : `${esc(a.label)} <span class="chip">upcoming</span>`;
        if (a.id === active.id) b.className = "active";
        b.addEventListener("click", () => {
          active = a; view = "list"; selected = new Set(liveSourcesFor(a).map(s => s.id));
          lastRows = []; facetState = emptyFacetState(); lastFetchedAt = null;
          buildRail(); buildNav(); refreshBar(); render();
        });
        section.appendChild(b);
      }
      rail.appendChild(section);
    }
  }

  function buildNav() {
    nav.innerHTML = "";
    if (!liveSourcesFor(active).length) return;   // upcoming artifact: no tabs/facet
    const tab = (id: "list" | "insights", label: string) => {
      const b = document.createElement("button");
      b.textContent = label;
      if (id === view) b.className = "active";
      b.addEventListener("click", () => { view = id; buildNav(); render(); });
      nav.appendChild(b);
    };
    tab("list", "List");
    if (hasInsights) tab("insights", "Insights");

    // Provider facet — toggle which similar providers feed this artifact's queue
    // (github + gitlab both pour into Vulnerabilities). Forward-compatible today.
    const facet = document.createElement("div"); facet.className = "facet";
    for (const s of sourcesFor(active)) {
      const live = s.status === "ready";
      const chip = document.createElement("button");
      chip.className = "prov-chip" + (live && selected.has(s.id) ? " on" : "") + (live ? "" : " soon");
      chip.innerHTML = `${providerIcon(providerOf(s), 14)}<span>${esc(providerOf(s))}</span>${live ? "" : `<span class="chip">upcoming</span>`}`;
      if (live) chip.addEventListener("click", () => {
        selected.has(s.id) ? selected.delete(s.id) : selected.add(s.id);
        lastRows = []; facetState = emptyFacetState(); lastFetchedAt = null; buildNav(); refreshBar(); render();
      });
      else chip.disabled = true;
      facet.appendChild(chip);
    }
    nav.appendChild(facet);
  }

  // silent: an auto-refresh tick re-fetches in place (no skeleton flash).
  const render = (silent = false) => {
    const live = liveSourcesFor(active);
    if (!live.length) {   // upcoming artifact placeholder
      const provs = sourcesFor(active).map(s => `<li>${providerIcon(providerOf(s), 14)} ${esc(providerOf(s))}</li>`).join("");
      root.innerHTML = `<div class="upcoming"><h2>${esc(active.label)} <span class="badge">upcoming</span></h2>
        <p class="muted">On the roadmap. Will triage from:</p><ul class="prov-roadmap">${provs}</ul></div>`;
      lastFetchedAt = null; updateSync();
      return;
    }
    if (!silent && view === "insights" && lastRows.length) { renderInsights(root, lastRows, active.kinds); return; }

    const usable = live.filter(s => selected.has(s.id) && creds.get(providerOf(s)) && Object.keys(scopes.get(providerOf(s))).length);
    if (!usable.length) {
      const needScope = live.some(s => selected.has(s.id) && creds.get(providerOf(s)) && !Object.keys(scopes.get(providerOf(s))).length);
      root.innerHTML = `<p class="muted">Open Settings to ${needScope ? "choose your scope" : "connect a token"}.</p>`;
      lastFetchedAt = null; updateSync();
      return;
    }
    if (!silent) renderTableSkeleton(root);
    Promise.all(usable.map(s => s.fetch(scopes.get(providerOf(s)), creds.get(providerOf(s))!)
      .then(r => r, (e): { items: never[]; errors: { target: string; message: string }[] } =>
        ({ items: [], errors: [{ target: s.id, message: e?.message ?? String(e) }] }))))
      .then(results => {
        const items = results.flatMap(r => r.items).filter(it => active.kinds.includes(it.kind));
        const errors = results.flatMap(r => r.errors);
        const rows: ScoredItem[] = items
          .map(it => { const score = resolveScorer(it.kind, scoreOverride)(it); return { ...it, score, tier: tierOf(score) }; })
          .sort((a, b) => b.score - a.score);
        lastRows = rows; lastFetchedAt = Date.now(); updateSync();
        if (view === "insights") { renderInsights(root, rows, active.kinds); return; }
        renderListWithFacets(rows, errors, creds.get(providerOf(usable[0]))!);
      })
      .catch(err => { root.innerHTML = `<p class="error">Failed to load: ${err?.message ?? err}</p>`; });
  };

  // List view: shell-owned FacetBar above a render-only body. Facet changes
  // re-filter lastRows and re-render only the body — never refetch.
  function renderListWithFacets(rows: ScoredItem[], errors: TriageError[], token: string) {
    root.innerHTML = `<div class="facet-host"></div><div class="surface-body"></div>`;
    const facetHost = root.querySelector<HTMLElement>(".facet-host")!;
    const body = root.querySelector<HTMLElement>(".surface-body")!;
    const drawBody = () => {
      const shown = applyFacets(rows, facetState);
      renderTriageList(body, shown, errors, { token });
    };
    const drawBar = () => renderFacetBar(facetHost, active, rows, facetState, next => {
      facetState = next; drawBar(); drawBody();
    });
    drawBar();
    drawBody();
  }

  syncTheme();
  buildRail();
  buildNav();
  refreshBar();
  updateSync();
  applyRefreshTimer();
  setInterval(updateSync, 30_000);   // keep the "updated Xm ago" stamp fresh
  render();
}
