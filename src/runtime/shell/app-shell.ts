import type { TriageConfigT } from "../../config/schema";
import { TokenStore } from "./storage";
import { getView, type ViewContext } from "../views/registry";
import { resolveScorer, type Scorer } from "../scoring/hooks";
// Register the bundled views (side-effect imports).
import "../views/security-alerts/view";

export function mountShell(config: TriageConfigT, scoreOverride?: Scorer) {
  const bar = document.getElementById("appbar")!;
  bar.textContent = config.branding.title;

  // Minimal settings: a token field that persists via TokenStore.
  const store = new TokenStore();
  const input = document.createElement("input");
  input.type = "password";
  input.placeholder = "Paste your token (stored in this tab only)";
  input.value = store.get() ?? "";
  input.addEventListener("change", () => store.set(input.value.trim()));
  bar.appendChild(input);

  const root = document.getElementById("root")!;
  const score = resolveScorer(scoreOverride);
  const ctx: ViewContext = {
    org: config.org,
    repos: config.repos,
    token: () => store.get(),
    score,
  };

  let current = config.views[0];
  const render = () => getView(current).mount(root, ctx);

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
  const refresh = document.createElement("button");
  refresh.textContent = "↻ Refresh";
  refresh.addEventListener("click", render);
  bar.appendChild(refresh);

  render();
}
