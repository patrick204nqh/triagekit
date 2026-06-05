import type { TriageConfigT } from "../../config/schema";
import { TokenStore } from "./storage";
import { PrefsStore } from "./prefs";
import { isCompiledConfig } from "./mode";
import { getView, type ViewContext } from "../views/registry";
import { resolveScorer, type Scorer } from "../scoring/hooks";
// Register the bundled views (side-effect imports).
import "../views/security-alerts/view";

function field(type: string, placeholder: string, value: string): HTMLInputElement {
  const el = document.createElement("input");
  el.type = type;
  el.placeholder = placeholder;
  el.value = value;
  return el;
}

export function mountShell(config: TriageConfigT, scoreOverride?: Scorer) {
  const bar = document.getElementById("appbar")!;
  bar.textContent = config.branding.title;

  const tokenStore = new TokenStore();
  const prefs = new PrefsStore();
  const compiled = isCompiledConfig(config);

  // In generic mode the user supplies org + repos at runtime; in compiled mode they
  // are baked in and only the token is entered.
  let orgInput: HTMLInputElement | undefined;
  let reposInput: HTMLInputElement | undefined;
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
  const score = resolveScorer(scoreOverride);
  let current = config.views[0];

  // Build a fresh context each render so generic-mode org/repos reflect current input.
  const render = () => {
    const ctx: ViewContext = {
      org: compiled ? config.org : prefs.getOrg(),
      repos: compiled ? config.repos : prefs.getRepos(),
      token: () => tokenStore.get(),
      score,
    };
    getView(current).mount(root, ctx);
  };

  // View switch built from config.views.
  const nav = document.getElementById("viewswitch")!;
  nav.innerHTML = "";
  nav.className = "viewswitch";
  for (const id of config.views) {
    const btn = document.createElement("button");
    btn.textContent = id;
    btn.addEventListener("click", () => { current = id; render(); });
    nav.appendChild(btn);
  }

  const load = document.createElement("button");
  load.textContent = compiled ? "↻ Refresh" : "Load alerts";
  load.addEventListener("click", render);
  bar.appendChild(load);

  render();
}
