import type { Source, Scope, DiscoveryOption } from "../ingest/source";
import { getDomain } from "../dataset/domain";
import type { CredStore } from "./cred-store";
import type { ScopeStore } from "./scope-store";
import { healthOf, scopeSummary } from "./health";

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}
interface Opts { sources: Source[]; creds: CredStore; scopes: ScopeStore; onChange: () => void; }

export function mountSettings(host: HTMLElement, opts: Opts) {
  const { sources, creds, scopes, onChange } = opts;
  host.innerHTML = `<div class="scrim" data-scrim></div>
    <aside class="sheet panel" data-panel aria-hidden="true">
      <div class="panel-head"><h3>Settings</h3><button class="icon-btn" data-close aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
      <div class="panel-body"><div class="set-group"><label class="set-label">Connections</label>
        <div class="conn-list" data-conns></div></div><div data-form></div></div>
    </aside>`;
  const scrim = host.querySelector<HTMLElement>("[data-scrim]")!;
  const panel = host.querySelector<HTMLElement>("[data-panel]")!;
  const conns = host.querySelector<HTMLElement>("[data-conns]")!;
  const form = host.querySelector<HTMLElement>("[data-form]")!;
  let selected = sources[0]?.id ?? "";

  const byId = (id: string) => sources.find(s => s.id === id)!;

  function renderConns() {
    conns.innerHTML = sources.map(s => {
      const h = healthOf(s, creds);
      const stat = h === "upcoming" ? "upcoming" : (h === "connected" ? "connected" : "no token");
      return `<button class="conn-item ${h === "connected" ? "ok" : ""} ${s.id === selected ? "active" : ""}" data-src="${esc(s.id)}">
        <span class="cdot"></span><span class="cinfo"><div class="cname">${esc(s.id)}</div>
        <div class="cmeta">${esc(getDomain(s.domain).label)} · ${esc(scopeSummary(s, scopes.get(s.id)))}</div></span>
        <span class="cstat">${stat}</span></button>`;
    }).join("");
    conns.querySelectorAll<HTMLElement>(".conn-item").forEach(b =>
      b.addEventListener("click", () => { selected = b.dataset.src!; renderConns(); renderForm(); }));
  }

  function renderForm() {
    const s = byId(selected); const off = s.status === "upcoming";
    const scope = scopes.get(s.id);
    let html = `<div class="set-group"><label class="set-label">${esc(s.id)} · ${esc(getDomain(s.domain).label)}</label></div>
      <div class="set-group"><label class="set-label">Credential</label>
        <input type="password" data-cred ${off ? "disabled" : ""} value="${creds.get(s.id) ? "••••••••" : ""}" placeholder="token / key — stored in this tab only"/>
        <span class="set-helper">Session-only, never persisted or embedded.</span></div>`;
    for (const f of s.scopeSchema) {
      html += `<div class="set-group"><label class="set-label">${esc(f.label)}</label>`;
      html += f.discoverable
        ? `<button class="btn-ghost" data-discover="${esc(f.key)}" ${off ? "disabled" : ""}>Find ${esc(f.label.toLowerCase())} I can access</button>
           <div class="checklist" data-list="${esc(f.key)}"></div>`
        : `<input type="text" data-field="${esc(f.key)}" ${off ? "disabled" : ""} value="${esc(((scope[f.key] as string[]) ?? []).join(", "))}" placeholder="${esc(f.label)} (comma-separated)"/>`;
      html += `</div>`;
    }
    form.innerHTML = html;

    const cred = form.querySelector<HTMLInputElement>("[data-cred]");
    cred?.addEventListener("input", () => { creds.set(s.id, cred.value.includes("•") ? creds.get(s.id) ?? "" : cred.value); renderConns(); onChange(); });

    form.querySelectorAll<HTMLInputElement>("[data-field]").forEach(inp =>
      inp.addEventListener("change", () => { scopes.set(s.id, { ...scopes.get(s.id), [inp.dataset.field!]: inp.value.split(/[\s,]+/).filter(Boolean) }); renderConns(); onChange(); }));

    form.querySelectorAll<HTMLElement>("[data-discover]").forEach(btn =>
      btn.addEventListener("click", () => runDiscover(s, btn.dataset.discover!)));
  }

  async function runDiscover(s: Source, key: string) {
    const list = form.querySelector<HTMLElement>(`[data-list="${key}"]`)!;
    list.innerHTML = `<div class="muted">Querying…</div>`;
    let opts: DiscoveryOption[] = [];
    try { opts = (await s.discover?.(creds.get(s.id) ?? "")) ?? []; }
    catch (e: any) { list.innerHTML = `<div class="error">${esc(e?.message ?? e)}</div>`; return; }
    const sel = new Set((scopes.get(s.id)[key] as string[]) ?? []);
    list.innerHTML = opts.map(o => `<label class="crow"><input type="checkbox" value="${esc(o.value)}" ${sel.has(o.value) ? "checked" : ""}>
      <span class="repo"><span class="org">${esc(o.group)}/</span>${esc(o.label)}</span></label>`).join("");
    list.querySelectorAll<HTMLInputElement>("input").forEach(cb => cb.addEventListener("change", () => {
      cb.checked ? sel.add(cb.value) : sel.delete(cb.value);
      scopes.set(s.id, { ...scopes.get(s.id), [key]: [...sel] }); renderConns(); onChange();
    }));
  }

  const close = () => { panel.classList.remove("open"); scrim.classList.remove("open"); panel.setAttribute("aria-hidden", "true"); };
  scrim.addEventListener("click", close);
  host.querySelector("[data-close]")!.addEventListener("click", close);

  return {
    open(sourceId?: string) {
      if (sourceId) selected = sourceId;
      renderConns(); renderForm();
      panel.classList.add("open"); scrim.classList.add("open"); panel.setAttribute("aria-hidden", "false");
    },
  };
}
