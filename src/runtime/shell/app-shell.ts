import type { TriageConfigT } from "../../config/schema";
import { TokenStore } from "./storage";
import { PrefsStore } from "./prefs";
import { isCompiledConfig } from "./mode";
import { getSource, listSources, type Scope } from "../ingest/source";
import { getView } from "../views/registry";
import { getDomain } from "../dataset/domain";
import { resolveScorer, type Scorer } from "../scoring/registry";
import { tierOf } from "../scoring/tier";
import { renderTriageTable, type ScoredItem } from "../layout/triage-table";
import { renderUpcoming } from "../layout/upcoming";
import "../views/security-alerts/view";   // register view + scorer + ready source
import "../ingest/upcoming";              // register roadmap sources

function field(type: string, placeholder: string, value: string): HTMLInputElement {
  const el = document.createElement("input");
  el.type = type; el.placeholder = placeholder; el.value = value; return el;
}

export function mountShell(config: TriageConfigT, scoreOverride?: Scorer) {
  const bar = document.getElementById("appbar")!;
  bar.textContent = config.branding.title;
  const tokenStore = new TokenStore();
  const prefs = new PrefsStore();
  const compiled = isCompiledConfig(config);
  const source = getSource(config.source);
  const upcoming = listSources().filter(s => s.status === "upcoming");

  // Plan 1: keep org/repos inputs (Plan 2 replaces these with the Settings slide-over).
  let orgInput: HTMLInputElement | undefined, reposInput: HTMLInputElement | undefined;
  if (!compiled) {
    orgInput = field("text", "org (e.g. acme-corp)", prefs.getOrg());
    orgInput.addEventListener("change", () => prefs.setOrg(orgInput!.value));
    reposInput = field("text", "repos (comma-separated)", prefs.getRepos().join(", "));
    reposInput.addEventListener("change", () => prefs.setRepos(reposInput!.value));
    bar.append(orgInput, reposInput);
  }
  const tokenInput = field("password", "Paste your token (stored in this tab only)", tokenStore.get() ?? "");
  tokenInput.addEventListener("change", () => tokenStore.set(tokenInput.value.trim()));
  bar.appendChild(tokenInput);

  const root = document.getElementById("root")!;
  let current = config.views[0];

  const render = () => {
    const up = upcoming.find(s => s.id === current);
    if (up) { renderUpcoming(root, up); return; }
    const view = getView(current);
    const scope: Scope = { org: compiled ? config.org : prefs.getOrg(), targets: compiled ? config.repos : prefs.getRepos() };
    const token = tokenStore.get();
    if (!scope.org || !(scope.targets as string[]).length) { root.innerHTML = `<p class="muted">Enter an org and at least one repo above, then Load.</p>`; return; }
    if (!token) { root.innerHTML = `<p class="muted">Paste your token above, then click Load.</p>`; return; }
    root.innerHTML = `<p class="muted">Loading…</p>`;
    const scorer = resolveScorer(view.kind, scoreOverride);
    source.fetch(scope, token)
      .then(({ items, errors }) => {
        const rows: ScoredItem[] = items.filter(it => it.kind === view.kind)
          .map(it => { const score = scorer(it); return { ...it, score, tier: tierOf(score) }; })
          .sort((a, b) => b.score - a.score);
        renderTriageTable(root, rows, errors);
      })
      .catch((err) => { root.innerHTML = `<p class="error">Failed to load: ${err?.message ?? err}</p>`; });
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

  const load = document.createElement("button");
  load.textContent = compiled ? "↻ Refresh" : "Load";
  load.addEventListener("click", render); bar.appendChild(load);
  render();
}
