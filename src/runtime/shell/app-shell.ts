import type { TriageConfigT } from "../../config/schema";
import { isCompiledConfig } from "./mode";
import { getSource, listSources, type Source } from "../ingest/source";
import { getView } from "../views/registry";
import { listDomains, getDomain, type DomainId } from "../dataset/domain";
import { resolveScorer, type Scorer } from "../scoring/registry";
import { tierOf } from "../scoring/tier";
import { renderTriageTable, renderTableSkeleton, esc, type ScoredItem } from "../layout/triage-table";
import { renderUpcoming } from "../layout/upcoming";
import { renderInsights } from "../layout/insights";
import { CredStore } from "./cred-store";
import { ScopeStore } from "./scope-store";
import { healthOf, scopeSummary } from "./health";
import { mountSettings } from "./settings";
import "../views/security-alerts/view";   // register view + scorer + ready source + charts
import "../ingest/upcoming";              // register roadmap sources

interface Tab { id: string; label: string; upcoming: boolean; }

export function mountShell(config: TriageConfigT, scoreOverride?: Scorer) {
  const creds = new CredStore();
  const scopes = new ScopeStore();
  const liveSource = getSource(config.source);
  if (isCompiledConfig(config)) scopes.set(liveSource.id, config.scope!);
  const upcoming = listSources().filter(s => s.status === "upcoming");

  // Domains shown in the rail: any domain that has the live source or a roadmap
  // source. Live domain is pinned first so the working view leads.
  const domainIds = listDomains()
    .map(d => d.id)
    .filter(id => id === liveSource.domain || upcoming.some(s => s.domain === id))
    .sort((a, b) => (a === liveSource.domain ? -1 : b === liveSource.domain ? 1 : 0));

  // Tabs within a domain: live config views (only under the live source's domain)
  // then that domain's roadmap sources, each badged "upcoming".
  const tabsFor = (id: DomainId): Tab[] => {
    const tabs: Tab[] = id === liveSource.domain
      ? config.views.map(v => ({ id: v, label: v, upcoming: false }))
      : [];
    for (const s of upcoming) if (s.domain === id) tabs.push({ id: s.id, label: s.id, upcoming: true });
    return tabs;
  };

  // The source the command bar reflects: live source under its domain, else the
  // first roadmap source of the active domain.
  const sourceFor = (id: DomainId): Source =>
    id === liveSource.domain ? liveSource : (upcoming.find(s => s.domain === id) ?? liveSource);

  let activeDomain: DomainId = liveSource.domain;
  let activeTab: string = tabsFor(activeDomain)[0]?.id ?? "";
  let lastRows: ScoredItem[] = [];

  // ── Command bar: brand + reflection-only controls (config lives in Settings) ──
  const bar = document.getElementById("appbar")!;
  bar.innerHTML = `<span class="brand">${esc(config.branding.title)}</span><div class="spacer"></div>`;
  const scopePill = document.createElement("button"); scopePill.className = "scope-pill";
  scopePill.innerHTML = `<span class="scope-label"></span><span class="caret"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m6 9 6 6 6-6"/></svg></span>`;
  const scopeLabel = scopePill.querySelector<HTMLElement>(".scope-label")!;
  const health = document.createElement("button"); health.className = "health";
  const load = document.createElement("button"); load.className = "btn-primary"; load.textContent = "Load";
  const gear = document.createElement("button"); gear.className = "icon-btn"; gear.setAttribute("aria-label", "Settings"); gear.title = "Settings";
  gear.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
  bar.append(scopePill, health, load, gear);

  const settingsHost = document.getElementById("settings-host")!;
  const settings = mountSettings(settingsHost, {
    sources: listSources(), creds, scopes,
    onChange: () => { refreshBar(); },
  });
  const openSettings = () => settings.open(sourceFor(activeDomain).id);
  scopePill.addEventListener("click", openSettings);
  health.addEventListener("click", openSettings);
  gear.addEventListener("click", openSettings);
  load.addEventListener("click", () => render());

  function refreshBar() {
    const src = sourceFor(activeDomain);
    scopeLabel.textContent = scopeSummary(src, scopes.get(src.id));
    const h = healthOf(src, creds);
    health.className = "health " + (h === "connected" ? "ok" : "warn");
    health.textContent = h === "connected" ? `${src.id} · connected`
      : h === "upcoming" ? `${src.id} · upcoming` : `${src.id} · token needed`;
  }

  // ── Navigation: domain rail → per-domain view switch ──
  const rail = document.getElementById("domainRail")!;
  const nav = document.getElementById("viewswitch")!;

  function buildRail() {
    rail.innerHTML = "";
    for (const id of domainIds) {
      const b = document.createElement("button");
      b.textContent = getDomain(id).label;
      if (id === activeDomain) b.className = "active";
      b.addEventListener("click", () => {
        activeDomain = id;
        activeTab = tabsFor(id)[0]?.id ?? "";
        buildRail(); buildSwitch(); refreshBar(); render();
      });
      rail.appendChild(b);
    }
  }

  function buildSwitch() {
    nav.innerHTML = "";
    for (const t of tabsFor(activeDomain)) {
      const b = document.createElement("button");
      b.innerHTML = t.upcoming ? `${esc(t.label)} <span class="chip">upcoming</span>` : esc(t.label);
      if (t.id === activeTab) b.className = "active";
      b.addEventListener("click", () => { activeTab = t.id; buildSwitch(); render(); });
      nav.appendChild(b);
    }
  }

  const root = document.getElementById("root")!;

  const render = () => {
    const up = upcoming.find(s => s.id === activeTab);
    if (up) { renderUpcoming(root, up); return; }
    const showInsights = activeTab === "insights";
    if (showInsights && lastRows.length) { renderInsights(root, lastRows, liveSource.kinds); return; }
    const scope = scopes.get(liveSource.id);
    const token = creds.get(liveSource.id);
    if (!Object.keys(scope).length) { root.innerHTML = `<p class="muted">Open Settings to choose your scope.</p>`; return; }
    if (!token) { root.innerHTML = `<p class="muted">Open Settings to connect a token.</p>`; return; }
    renderTableSkeleton(root);
    liveSource.fetch(scope, token)
      .then(({ items, errors }) => {
        const rows: ScoredItem[] = items
          .map(it => { const score = resolveScorer(it.kind, scoreOverride)(it); return { ...it, score, tier: tierOf(score) }; })
          .sort((a, b) => b.score - a.score);
        lastRows = rows;
        if (showInsights) renderInsights(root, rows, liveSource.kinds);
        else renderTriageTable(root, rows.filter(r => r.kind === getView(activeTab).kind), errors);
      })
      .catch(err => { root.innerHTML = `<p class="error">Failed to load: ${err?.message ?? err}</p>`; });
  };

  buildRail();
  buildSwitch();
  refreshBar();
  render();
}
