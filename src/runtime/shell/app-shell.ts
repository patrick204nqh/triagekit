import type { TriageConfigT } from "../../config/schema";
import { isCompiledConfig } from "./mode";
import { getSource, listSources } from "../ingest/source";
import { getView } from "../views/registry";
import { getDomain } from "../dataset/domain";
import { resolveScorer, type Scorer } from "../scoring/registry";
import { tierOf } from "../scoring/tier";
import { renderTriageTable } from "../layout/triage-table";
import { renderUpcoming } from "../layout/upcoming";
import { CredStore } from "./cred-store";
import { ScopeStore } from "./scope-store";
import { healthOf, scopeSummary } from "./health";
import { mountSettings } from "./settings";
import "../views/security-alerts/view";   // register view + scorer + ready source
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
  const gear = document.createElement("button"); gear.className = "icon-btn"; gear.textContent = "⚙";
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

  const render = () => {
    const up = upcoming.find(s => s.id === current);
    if (up) { renderUpcoming(root, up); return; }
    const view = getView(current);
    const scope = scopes.get(source.id);
    const token = creds.get(source.id);
    if (!Object.keys(scope).length) { root.innerHTML = `<p class="muted">Open Settings (⚙) to choose your scope.</p>`; return; }
    if (!token) { root.innerHTML = `<p class="muted">Open Settings (⚙) to connect a token.</p>`; return; }
    root.innerHTML = `<p class="muted">Loading…</p>`;
    const scorer = resolveScorer(view.kind, scoreOverride);
    source.fetch(scope, token)
      .then(({ items, errors }) => {
        const rows = items.filter(it => it.kind === view.kind)
          .map(it => { const score = scorer(it); return { ...it, score, tier: tierOf(score) }; })
          .sort((a, b) => b.score - a.score);
        renderTriageTable(root, rows, errors);
      })
      .catch(err => { root.innerHTML = `<p class="error">Failed to load: ${err?.message ?? err}</p>`; });
  };

  // View switch grouped by domain: ready views first, then upcoming sources under their domain.
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
