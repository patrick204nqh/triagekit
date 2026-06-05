import type { TriageConfigT } from "../../config/schema";
import { isCompiledConfig } from "./mode";
import { getSource, listSources, type Source } from "../ingest/source";
import { listArtifacts, type Artifact } from "../dataset/artifact";
import { resolveScorer, type Scorer } from "../scoring/registry";
import { tierOf } from "../scoring/tier";
import { renderTriageTable, renderTableSkeleton, esc, type ScoredItem } from "../layout/triage-table";
import { renderInsights } from "../layout/insights";
import { CredStore } from "./cred-store";
import { ScopeStore } from "./scope-store";
import { healthOf, scopeSummary } from "./health";
import { mountSettings } from "./settings";
import { providerIcon } from "./provider-icons";
import { getThemeChoice, resolveTheme, setThemeChoice } from "./theme";
import "../views/security-alerts/view";   // register view + scorer + ready source + charts
import "../ingest/upcoming";              // register roadmap sources

// Product mark: a funnel (many signals in → a triaged few out) whose drip is the
// teal accent, echoing the "·" in the wordmark.
const BRAND_MARK = `<svg class="brand-mark" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3.5 5.5H20.5L13 14.5V18H11V14.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="20.8" r="1.7" fill="var(--accent)"/></svg>`;
const SUN = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`;
const MOON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
const GEAR = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;

export function mountShell(config: TriageConfigT, scoreOverride?: Scorer) {
  const creds = new CredStore();
  const scopes = new ScopeStore();
  const liveSource = getSource(config.source);
  if (isCompiledConfig(config)) scopes.set(liveSource.id, config.scope!);
  const hasInsights = config.views.includes("insights");

  const sourcesFor = (a: Artifact) => listSources().filter(s => s.kinds.some(k => a.kinds.includes(k)));
  const liveSourcesFor = (a: Artifact) => sourcesFor(a).filter(s => s.status === "ready");
  const artifacts = listArtifacts().filter(a => sourcesFor(a).length > 0);
  const primarySource = (a: Artifact): Source => liveSourcesFor(a)[0] ?? sourcesFor(a)[0];

  let active: Artifact = artifacts.find(a => liveSourcesFor(a).length) ?? artifacts[0];
  let view: "list" | "insights" = "list";
  let selected = new Set(liveSourcesFor(active).map(s => s.id));   // provider facet
  let lastRows: ScoredItem[] = [];

  // ── Command bar: brand + merged status chip + theme + settings ──
  const bar = document.getElementById("appbar")!;
  const titleHtml = esc(config.branding.title).replace(/·/g, `<span class="dot">·</span>`);
  bar.innerHTML = `<span class="brand">${BRAND_MARK}<span class="wordmark">${titleHtml}</span></span><div class="spacer"></div>`;
  const status = document.createElement("button"); status.className = "status-chip";
  const load = document.createElement("button"); load.className = "btn-primary"; load.textContent = "Load";
  const themeBtn = document.createElement("button"); themeBtn.className = "icon-btn"; themeBtn.setAttribute("aria-label", "Toggle theme");
  const gear = document.createElement("button"); gear.className = "icon-btn"; gear.setAttribute("aria-label", "Settings"); gear.title = "Settings"; gear.innerHTML = GEAR;
  bar.append(status, load, themeBtn, gear);

  const settingsHost = document.getElementById("settings-host")!;
  const settings = mountSettings(settingsHost, {
    sources: listSources(), creds, scopes,
    onChange: () => { lastRows = []; refreshBar(); render(); },
    onThemeChange: () => syncTheme(),
  });
  const openSettings = () => settings.open(primarySource(active).id);
  status.addEventListener("click", openSettings);
  gear.addEventListener("click", openSettings);
  load.addEventListener("click", () => { lastRows = []; render(); });

  function syncTheme() {
    const dark = resolveTheme(getThemeChoice()) === "dark";
    themeBtn.innerHTML = dark ? SUN : MOON;
    themeBtn.title = dark ? "Switch to light" : "Switch to dark";
  }
  themeBtn.addEventListener("click", () => {
    setThemeChoice(resolveTheme(getThemeChoice()) === "dark" ? "light" : "dark");
    syncTheme();
  });

  function refreshBar() {
    const src = primarySource(active);
    const h = healthOf(src, creds);
    status.className = "status-chip " + (h === "connected" ? "ok" : "warn");
    const tail = h === "connected" ? scopeSummary(src, scopes.get(src.id))
      : h === "upcoming" ? "upcoming" : "token needed";
    status.innerHTML = `${providerIcon(src.id, 15)}<span class="sid">${esc(src.id)}</span><span class="sep">·</span><span class="muted">${esc(tail)}</span>`;
  }

  // ── Navigation: artifact rail → list/insights + provider facet ──
  const rail = document.getElementById("domainRail")!;
  const nav = document.getElementById("viewswitch")!;
  const root = document.getElementById("root")!;

  function buildRail() {
    rail.innerHTML = "";
    for (const a of artifacts) {
      const live = liveSourcesFor(a).length > 0;
      const b = document.createElement("button");
      b.innerHTML = live ? esc(a.label) : `${esc(a.label)} <span class="chip">upcoming</span>`;
      if (a.id === active.id) b.className = "active";
      b.addEventListener("click", () => {
        active = a; view = "list"; selected = new Set(liveSourcesFor(a).map(s => s.id)); lastRows = [];
        buildRail(); buildNav(); refreshBar(); render();
      });
      rail.appendChild(b);
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

    // Provider facet — toggle which sources feed the queue (forward-compatible
    // with multiple live providers; today GitHub is the only one).
    const facet = document.createElement("div"); facet.className = "facet";
    for (const s of sourcesFor(active)) {
      const live = s.status === "ready";
      const chip = document.createElement("button");
      chip.className = "prov-chip" + (live && selected.has(s.id) ? " on" : "") + (live ? "" : " soon");
      chip.innerHTML = `${providerIcon(s.id, 14)}<span>${esc(s.id)}</span>${live ? "" : `<span class="chip">soon</span>`}`;
      if (live) chip.addEventListener("click", () => {
        selected.has(s.id) ? selected.delete(s.id) : selected.add(s.id);
        lastRows = []; buildNav(); render();
      });
      else chip.disabled = true;
      facet.appendChild(chip);
    }
    nav.appendChild(facet);
  }

  const render = () => {
    const live = liveSourcesFor(active);
    if (!live.length) {   // upcoming artifact placeholder
      const provs = sourcesFor(active).map(s => `<li>${providerIcon(s.id, 14)} ${esc(s.id)}</li>`).join("");
      root.innerHTML = `<div class="upcoming"><h2>${esc(active.label)} <span class="badge">upcoming</span></h2>
        <p class="muted">On the roadmap. Will triage from:</p><ul class="prov-roadmap">${provs}</ul></div>`;
      return;
    }
    if (view === "insights" && lastRows.length) { renderInsights(root, lastRows, active.kinds); return; }

    const usable = live.filter(s => selected.has(s.id) && creds.get(s.id) && Object.keys(scopes.get(s.id)).length);
    if (!usable.length) {
      const needScope = live.some(s => selected.has(s.id) && creds.get(s.id) && !Object.keys(scopes.get(s.id)).length);
      root.innerHTML = `<p class="muted">Open Settings to ${needScope ? "choose your scope" : "connect a token"}.</p>`;
      return;
    }
    renderTableSkeleton(root);
    Promise.all(usable.map(s => s.fetch(scopes.get(s.id), creds.get(s.id)!)
      .then(r => r, (e): { items: never[]; errors: { target: string; message: string }[] } =>
        ({ items: [], errors: [{ target: s.id, message: e?.message ?? String(e) }] }))))
      .then(results => {
        const items = results.flatMap(r => r.items).filter(it => active.kinds.includes(it.kind));
        const errors = results.flatMap(r => r.errors);
        const rows: ScoredItem[] = items
          .map(it => { const score = resolveScorer(it.kind, scoreOverride)(it); return { ...it, score, tier: tierOf(score) }; })
          .sort((a, b) => b.score - a.score);
        lastRows = rows;
        if (view === "insights") renderInsights(root, rows, active.kinds);
        else renderTriageTable(root, rows, errors);
      })
      .catch(err => { root.innerHTML = `<p class="error">Failed to load: ${err?.message ?? err}</p>`; });
  };

  syncTheme();
  buildRail();
  buildNav();
  refreshBar();
  render();
}
