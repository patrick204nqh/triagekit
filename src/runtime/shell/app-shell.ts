import type { TriageConfigT } from "../../config/schema";
import { isCompiledConfig } from "./mode";
import { getSource, listSources } from "../ingest/source";
import { getView } from "../views/registry";
import { getDomain } from "../dataset/domain";
import { resolveScorer, type Scorer } from "../scoring/registry";
import { tierOf } from "../scoring/tier";
import { renderTriageTable, renderTableSkeleton, type ScoredItem } from "../layout/triage-table";
import { renderUpcoming } from "../layout/upcoming";
import { renderInsights } from "../layout/insights";
import { CredStore } from "./cred-store";
import { ScopeStore } from "./scope-store";
import { healthOf, scopeSummary } from "./health";
import { mountSettings } from "./settings";
import "../views/security-alerts/view";   // register view + scorer + ready source + charts
import "../ingest/upcoming";              // register roadmap sources

export function mountShell(config: TriageConfigT, scoreOverride?: Scorer) {
  const bar = document.getElementById("appbar")!;
  bar.textContent = config.branding.title;
  const creds = new CredStore();
  const scopes = new ScopeStore();
  const source = getSource(config.source);
  if (isCompiledConfig(config)) scopes.set(source.id, config.scope!);
  const upcoming = listSources().filter(s => s.status === "upcoming");

  // Reflection-only command bar — all config lives in the Settings slide-over.
  const scopePill = document.createElement("button"); scopePill.className = "scope-pill";
  const health = document.createElement("button"); health.className = "health";
  const gear = document.createElement("button"); gear.className = "icon-btn"; gear.setAttribute("aria-label", "Settings"); gear.title = "Settings";
  gear.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
  const load = document.createElement("button"); load.className = "btn-primary"; load.textContent = "Load";
  bar.append(scopePill, health, load, gear);

  const settingsHost = document.getElementById("settings-host")!;
  const settings = mountSettings(settingsHost, {
    sources: listSources(), creds, scopes,
    onChange: () => { refreshBar(); },
  });
  const openSettings = () => settings.open(source.id);
  scopePill.addEventListener("click", openSettings);
  health.addEventListener("click", openSettings);
  gear.addEventListener("click", openSettings);

  function refreshBar() {
    scopePill.textContent = scopeSummary(source, scopes.get(source.id));
    const h = healthOf(source, creds);
    health.className = "health " + (h === "connected" ? "ok" : "warn");
    health.textContent = h === "connected" ? `${source.id} · connected` : `${source.id} · token needed`;
  }

  const root = document.getElementById("root")!;
  let current = config.views[0];
  let lastRows: ScoredItem[] = [];

  const render = () => {
    const up = upcoming.find(s => s.id === current);
    if (up) { renderUpcoming(root, up); return; }
    const showInsights = current === "insights";
    if (showInsights && lastRows.length) { renderInsights(root, lastRows, source.kinds); return; }
    const scope = scopes.get(source.id);
    const token = creds.get(source.id);
    if (!Object.keys(scope).length) { root.innerHTML = `<p class="muted">Open Settings to choose your scope.</p>`; return; }
    if (!token) { root.innerHTML = `<p class="muted">Open Settings to connect a token.</p>`; return; }
    renderTableSkeleton(root);
    source.fetch(scope, token)
      .then(({ items, errors }) => {
        const rows: ScoredItem[] = items
          .map(it => { const score = resolveScorer(it.kind, scoreOverride)(it); return { ...it, score, tier: tierOf(score) }; })
          .sort((a, b) => b.score - a.score);
        lastRows = rows;
        if (showInsights) renderInsights(root, rows, source.kinds);
        else renderTriageTable(root, rows.filter(r => r.kind === getView(current).kind), errors);
      })
      .catch(err => { root.innerHTML = `<p class="error">Failed to load: ${err?.message ?? err}</p>`; });
  };

  // View switch: ready views first, then upcoming sources under their domain.
  const nav = document.getElementById("viewswitch")!;
  nav.innerHTML = ""; nav.className = "viewswitch";
  const addBtn = (id: string, label: string) => {
    const b = document.createElement("button"); b.textContent = label;
    b.addEventListener("click", () => { current = id; render(); }); nav.appendChild(b);
  };
  for (const id of config.views) addBtn(id, id);
  for (const s of upcoming) addBtn(s.id, `${s.id} · ${getDomain(s.domain).label}`);

  load.addEventListener("click", render);
  refreshBar();
  render();
}
